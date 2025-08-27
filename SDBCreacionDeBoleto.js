/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

define(['N/record', 'N/search', 'N/error'], function (record, search, error) {

    function post(requestBody) {
        try {
            const ticketType = requestBody.tipoTicket;
            switch (ticketType) {
                case "EX":
                    log.debug("Procesando Boleto tipo EX");
                    var subsidiaryId = checkSubsidiary(requestBody.empresa); //Chequeo que exista la subsidiaria
                    var customerData = requestBody.remarks;
                    var customer = findCustomer(customerData, subsidiaryId);

                    if (subsidiaryId && customer) {
                        const exchanges = [];          // [{ oldNumber, newId }]
                        let totalAmmount = 0;
                        const ticketGroup = createTicketGroup(requestBody, customer);

                        requestBody.boletos.forEach(function (ticket) {

                            const newTicketId = createTicket(ticketType, ticket, ticketGroup);
                            if (ticket.exchange) {
                                exchanges.push({ oldNumber: ticket.exchange, newId: newTicketId });
                            }
                            if (Array.isArray(ticket.tarjetas) && ticket.tarjetas.length > 0) {
                                createCards(ticket.tarjetas, newTicketId);
                            }
                            totalAmmount += parseFloat(ticket.total || 0);
                        });

                        // Marcar los boletos originales como modificados
                        if (exchanges.length > 0) {
                            markReferenceTickets(exchanges, 'EX');
                        }

                        if (totalAmmount > 0) { //Si tiene diferencias de monto entonces si creo los registros correspondientes.
                            createPurchaseBill(requestBody, ticketGroup, subsidiaryId) //Se crea la Factura de compra al vendor externo (sea intercompany o no la voy a crear desde la subsidiaria actual)
                            if (subsidiaryId != customer.subsidiaryId) {//Caso intercompany entonces agrego factura de compra y venta.
                                createIntercompanyInvoice(requestBody, subsidiaryId, customer.subsidiaryId, ticketGroup)
                                createPurchaseIntercompanyBill(requestBody, customer.subsidiaryId, ticketGroup, subsidiaryId)
                            }
                            createSalesOrder(requestBody, customer, ticketGroup); //Creo sale order para el cliente final
                        }
                    }
                    break;

                case "EMD":
                    log.debug("Procesando Boleto tipo EMD");
                    var subsidiaryId = checkSubsidiary(requestBody.empresa);
                    var customerData;
                    const emds = [];          // [{ oldNumber, newId }]
                    let totalAmmount = 0;
                    const ticketGroup = createTicketGroup(requestBody);

                    requestBody.boletos.forEach(function (ticket) {
                        const newTicketId = createTicket(ticketType, ticket, ticketGroup);
                        if (ticket.emdnumero) {
                            emds.push({ oldNumber: ticket.emdnumero, newId: newTicketId });
                        }
                        if (Array.isArray(ticket.tarjetas) && ticket.tarjetas.length > 0) {
                            createCards(ticket.tarjetas, newTicketId);
                        }
                        totalAmmount += parseFloat(ticket.total || 0);
                    });

                    if (emds.length > 0) {
                        markReferenceTickets(emds, 'EMD');// Marcar los boletos originales como modificados

                        for (var i = 0; i < emds.length; i++) {
                            if (emds[i].oldNumber) {
                                customerData = findDataEmd(emds[0].oldNumber)
                            }
                        }
                    }
                    if (totalAmmount > 0 && customerData) { //Si tiene diferencias de monto y se encontró customer entonces si creo los registros correspondientes.
                        createPurchaseBill(requestBody, ticketGroup, subsidiaryId) //Se crea la Factura de compra al vendor externo (sea intercompany o no la voy a crear desde la subsidiaria actual)
                        if (subsidiaryId != customerData.subsidiaryId) {//Caso intercompany entonces agrego factura de compra y venta.
                            createIntercompanyInvoice(requestBody, subsidiaryId, customerData.subsidiaryId, ticketGroup)
                            createPurchaseIntercompanyBill(requestBody, customerData.subsidiaryId, ticketGroup, subsidiaryId)
                        }
                        createSalesOrder(requestBody, customerData, ticketGroup); //Creo sale order para el cliente final
                    }
                    break;

                case "ET": // Lógica para Boleto común
                    log.debug("Procesando Boleto tipo ET");
                    var subsidiaryId = checkSubsidiary(requestBody.empresa); //Chequeo que exista la subsidiaria
                    var customerData = requestBody.remarks;
                    var customer = findCustomer(customerData, subsidiaryId);

                    if (subsidiaryId && customer) {
                        const ticketGroup = createTicketGroup(requestBody, customer);

                        requestBody.boletos.forEach(function (ticket) {
                            var ticketId = createTicket(ticketType, ticket, ticketGroup);
                            if (Array.isArray(ticket.tarjetas) && ticket.tarjetas.length > 0) {
                                createCards(ticket.tarjetas, ticketId);
                            }
                        })

                        createPurchaseBill(requestBody, ticketGroup, subsidiaryId) //Se crea la Factura de compra al vendor externo (sea intercompany o no la voy a crear desde la subsidiaria actual)
                        if (subsidiaryId != customer.subsidiaryId) {//Caso intercompany entonces agrego factura de compra y venta.
                            createIntercompanyInvoice(requestBody, subsidiaryId, customer.subsidiaryId, ticketGroup)
                            createPurchaseIntercompanyBill(requestBody, customer.subsidiaryId, ticketGroup, subsidiaryId)
                        }
                        createSalesOrder(requestBody, customer, ticketGroup); //Creo sale order para el cliente final
                    }
                    break;
                default:
                    log.debug("Tipo de ticket no reconocido", ticketType);
                    break;
            }
            return {
                success: true,
                message: 'Solicitud ejecutada',
            };
        } catch (error) {
            logError(error, {
                module: 'post',
                relatedId: requestBody.id,
                bodyRequest: JSON.stringify(requestBody)
            });
            return {
                success: false,
                message: error.message || 'Error',
            }
        }
    }

    function createTicket(ticketType, ticket, ticketGroupId) { //Crea Boleto 
        var newTicketRecord = record.create({
            type: "customrecord_boleto",
            isDynamic: true
        });
        newTicketRecord.setValue({ fieldId: 'custrecord_grupo', value: ticketGroupId });
        newTicketRecord.setValue({ fieldId: 'name', value: `Boleto ${ticket.boleto}` });
        newTicketRecord.setValue({ fieldId: 'custrecord_idboleto', value: ticket.id });
        newTicketRecord.setValue({ fieldId: 'custrecord_idaerolinea', value: ticket.aerolinea.id });
        newTicketRecord.setValue({ fieldId: 'custrecord_codigoaerolinea', value: ticket.aerolinea.code });
        newTicketRecord.setValue({ fieldId: 'custrecord_aerolinea', value: ticket.aerolinea.aerolinea });
        newTicketRecord.setValue({ fieldId: 'custrecord_iniciales', value: ticket.aerolinea.iniciales });
        newTicketRecord.setValue({ fieldId: 'custrecord_origen', value: ticket.aerolinea.origen });
        newTicketRecord.setValue({ fieldId: 'custrecord_codigodegrupo', value: ticket.aerolinea.codeGroup });
        newTicketRecord.setValue({ fieldId: 'custrecord_numeroboleto', value: ticket.boleto });
        newTicketRecord.setValue({ fieldId: 'custrecord_sdb_ticket_type', value: ticketType });
        if (ticket.fecha) newTicketRecord.setValue({ fieldId: 'custrecord_fecha', value: new Date(ticket.fecha) });
        if (ticket.fechareserva) newTicketRecord.setValue({ fieldId: 'custrecord_fechareserva', value: new Date(ticket.fechareserva) });
        if (ticket.horareserva) newTicketRecord.setValue({ fieldId: 'custrecord_horareserva', value: new Date(ticket.horareserva) });
        if (ticket.horaemision) newTicketRecord.setValue({ fieldId: 'custrecord_horaemision', value: new Date(ticket.horaemision) });
        newTicketRecord.setValue({ fieldId: 'custrecord_pasajero', value: ticket.pasajero });
        newTicketRecord.setValue({ fieldId: 'custrecord_oidreserva', value: ticket.oidreserva });
        newTicketRecord.setValue({ fieldId: 'custrecord_ticketeadorreserva', value: ticket.ticketeadorReserva });
        newTicketRecord.setValue({ fieldId: 'custrecord_oidemision', value: ticket.oidemision });
        newTicketRecord.setValue({ fieldId: 'custrecord_ticketeadoremision', value: ticket.ticketeadorEmision });
        newTicketRecord.setValue({ fieldId: 'custrecord_codigoiata', value: ticket.codigoIata });
        newTicketRecord.setValue({ fieldId: 'custrecord_taxec', value: ticket.taxec });
        newTicketRecord.setValue({ fieldId: 'custrecord_taxed', value: ticket.taxed });
        newTicketRecord.setValue({ fieldId: 'custrecord_taxotro', value: ticket.taxotro });
        newTicketRecord.setValue({ fieldId: 'custrecord_taxcombustible', value: ticket.taxcombustible });
        newTicketRecord.setValue({ fieldId: 'custrecord_tarifa', value: ticket.tarifa });
        newTicketRecord.setValue({ fieldId: 'custrecord_tarifamoneda', value: ticket.tarifaMoneda });
        newTicketRecord.setValue({ fieldId: 'custrecord_total', value: ticket.total });
        newTicketRecord.setValue({ fieldId: 'custrecord_pagocash', value: ticket.pagocash });
        newTicketRecord.setValue({ fieldId: 'custrecord_pagotc', value: ticket.pagotc });
        newTicketRecord.setValue({ fieldId: 'custrecord_void', value: ticket.void });
        newTicketRecord.setValue({ fieldId: 'custrecord_numero', value: ticket.numero });
        newTicketRecord.setValue({ fieldId: 'custrecord_numpasajero', value: ticket.numPasajero });
        newTicketRecord.setValue({ fieldId: 'custrecord_comision', value: ticket.comision });

        var boletoId = newTicketRecord.save();
        log.debug('Boleto creado', 'ID: ' + boletoId);
        return boletoId
    }

    function createTicketGroup(requestBody, customer) { //crea el grupo de boletos y las rutas.
        var newTicketGroup = record.create({
            type: "customrecord_grupoboletos",
            isDynamic: true
        });

        newTicketGroup.setValue({ fieldId: 'name', value: `Grupo de boletos ${requestBody.id}` });
        if (customer) newTicketGroup.setValue({ fieldId: 'custrecord_sdb_customer', value: customer.customerId });
        newTicketGroup.setValue({ fieldId: 'custrecord_iddocumento', value: requestBody.id });
        newTicketGroup.setValue({ fieldId: 'custrecord_idarchivo', value: requestBody.idarchivo });
        newTicketGroup.setValue({ fieldId: 'custrecord_record', value: requestBody.record });
        newTicketGroup.setValue({ fieldId: 'custrecord_recordaerolinea', value: requestBody.recordAerolinea });
        newTicketGroup.setValue({ fieldId: 'custrecord_airticket', value: requestBody.airTktt });
        newTicketGroup.setValue({ fieldId: 'custrecord_tipoticket', value: requestBody.tipoTicket });
        newTicketGroup.setValue({ fieldId: 'custrecord_farecalculation', value: requestBody.farecalculation });
        newTicketGroup.setValue({ fieldId: 'custrecord_gds', value: requestBody.gds });
        newTicketGroup.setValue({ fieldId: 'custrecord_sistemadistribucion', value: requestBody.sistemaDistribucion });
        newTicketGroup.setValue({ fieldId: 'custrecord_empresa', value: requestBody.empresa });
        newTicketGroup.setValue({ fieldId: 'custrecord_domint', value: requestBody.domInt });
        newTicketGroup.setValue({ fieldId: 'custrecord_tourcode', value: requestBody.tourcode });
        newTicketGroup.setValue({ fieldId: 'custrecord_bassetid', value: requestBody.bassetId });
        newTicketGroup.setValue({ fieldId: 'custrecord_dk', value: requestBody.dk });
        if (requestBody.fechacaptura) {
            newTicketGroup.setValue({ fieldId: 'custrecord_fechacaptura', value: new Date(requestBody.fechacaptura) });
        }

        var ticketGroup = newTicketGroup.save();
        log.debug('Grupo de boletos ' + requestBody.id + ' creado', ticketGroup);
        // Crear rutas
        var routes = requestBody.routings || [];
        for (var route of routes) {
            createRoute(route, ticketGroup, requestBody.id)
        }
        return ticketGroup;
    }

    function createRoute(route, ticketGroupInternalId, requestBodyId) {
        var newRoute = record.create({
            type: "customrecord_ruta",
            isDynamic: true
        });
        newRoute.setValue({ fieldId: 'name', value: `Ruta ${route.numero} del grupo ${requestBodyId}` });
        newRoute.setValue({ fieldId: 'custrecord_grupoboletosruta', value: ticketGroupInternalId });
        newRoute.setValue({ fieldId: "custrecord_xo", value: route.xo });
        newRoute.setValue({ fieldId: "custrecord_farebasis", value: route.farebasis });
        newRoute.setValue({ fieldId: "custrecord_ticketdesignator", value: route.ticketDesignator });
        newRoute.setValue({ fieldId: "custrecord_ruta", value: route.ruta });
        newRoute.setValue({ fieldId: "custrecord_carrier", value: route.carrier });
        newRoute.setValue({ fieldId: "custrecord_vuelo", value: route.vuelo });
        newRoute.setValue({ fieldId: "custrecord_clase", value: route.clase });
        newRoute.setValue({ fieldId: "custrecord_fechasalida", value: route.fechasalida });
        newRoute.setValue({ fieldId: "custrecord_horasalida", value: route.horasalida });
        newRoute.setValue({ fieldId: "custrecord_fechallegada", value: route.fechallegada });
        newRoute.setValue({ fieldId: "custrecord_horallegada", value: route.horallegada });
        newRoute.setValue({ fieldId: "custrecord_numeroruta", value: route.numero });
        newRoute.setValue({ fieldId: "custrecord_rutacompartida", value: !!route.rutaCompartida });
        newRoute.setValue({ fieldId: "custrecord_cabina", value: route.cabina });
        newRoute.setValue({ fieldId: "custrecord_familiatarifaria", value: route.familiaTarifaria });

        var routeCreated = newRoute.save();
        if (routeCreated) {
            log.debug('Ruta ' + route.numero + ' del grupo ' + requestBodyId + ' creada ');
        }
        else {
            throw new Error(`No se pudo crear la ruta ${route.numero} del grupo ${requestBodyId}`);
        }
        return routeCreated;
    }

    //crea factura de compra al proveedor externo
    function createPurchaseBill(requestBody, ticketGroup, subsidiaryId) {
        var tickets = requestBody.boletos || [];
        var rutas = (requestBody.routings || []).map(function (r) { return r.ruta; });
        var rutasStr = rutas.join(', ');

        var billRecord = record.create({
            type: record.Type.VENDOR_BILL,
            isDynamic: true
        });

        var vendorid = getVendor(requestBody.boletos[0].aerolinea.aerolinea);
        billRecord.setValue({ fieldId: 'entity', value: vendorid });
        billRecord.setValue({ fieldId: 'subsidiary', value: subsidiaryId });
        billRecord.setValue({ fieldId: 'custbody_sdb_ticket_group', value: ticketGroup });
        billRecord.setValue({ fieldId: 'custbody_sdb_created_from', value: true });

        tickets.forEach(function (ticket) {
            const startLine = billRecord.getLineCount({ sublistId: 'item' });
            billRecord.selectNewLine({ sublistId: 'item' });
            billRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: 264 });
            billRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
            billRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_ticket_number', value: ticket.boleto });
            billRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_ticket_route', value: rutasStr });
            billRecord.commitLine({ sublistId: 'item' });

            const endLine = billRecord.getLineCount({ sublistId: 'item' });
            setValuesToChargeItems(requestBody, billRecord, ticket, startLine, endLine);
        });

        var billId = billRecord.save();
        log.debug('Factura de compra creada', billId);

        return billId;
    }

    //Crea Factura de compra intercompany
    function createPurchaseIntercompanyBill(requestBody, customerSubsidiaryId, ticketGroup, subsidiaryId) {
        var tickets = requestBody.boletos || [];
        var rutas = (requestBody.routings || []).map(function (r) { return r.ruta; });
        var rutasStr = rutas.join(', ');

        var billIntercompanyRecord = record.create({
            type: record.Type.VENDOR_BILL,
            isDynamic: true
        });
        var subsidiaryRepresentativeId = getSubsidiaryClientRepresentative(subsidiaryId);

        billIntercompanyRecord.setValue({ fieldId: 'entity', value: subsidiaryRepresentativeId });
        billIntercompanyRecord.setValue({ fieldId: 'subsidiary', value: customerSubsidiaryId });
        billIntercompanyRecord.setValue({ fieldId: 'custbody_sdb_ticket_group', value: ticketGroup });
        billIntercompanyRecord.setValue({ fieldId: 'custbody_sdb_created_from', value: true });

        tickets.forEach(function (ticket) {
            const startLine = billIntercompanyRecord.getLineCount({ sublistId: 'item' });

            billIntercompanyRecord.selectNewLine({ sublistId: 'item' });
            billIntercompanyRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: 264 });
            billIntercompanyRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
            billIntercompanyRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_ticket_number', value: ticket.boleto });
            billIntercompanyRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_ticket_route', value: rutasStr });
            billIntercompanyRecord.commitLine({ sublistId: 'item' });

            const endLine = billIntercompanyRecord.getLineCount({ sublistId: 'item' });
            setValuesToChargeItems(requestBody, billIntercompanyRecord, ticket, startLine, endLine);
        });

        var billIntercompanyId = billIntercompanyRecord.save();
        log.debug('Factura intercompany creada', billIntercompanyId);

        return billIntercompanyId;
    }

    function createSalesOrder(requestBody, customer, ticketGroup) {
        var tickets = requestBody.boletos || [];
        var customerId = customer.customerId;
        var customerSubsidiaryId = customer.subsidiaryId;
        var airline = tickets[0].aerolinea;
        var rutas = (requestBody.routings || []).map(function (r) { return r.ruta; });
        var rutasStr = rutas.join(', ');

        var salesOrder = record.create({   //Creo la Sale order desde la subsidiaria real del cliente al cliente final.
            type: record.Type.SALES_ORDER,
            isDynamic: true
        });

        salesOrder.setValue({ fieldId: 'entity', value: customerId });
        salesOrder.setValue({ fieldId: 'subsidiary', value: customerSubsidiaryId });
        salesOrder.setValue({ fieldId: 'trandate', value: new Date() });
        salesOrder.setValue({ fieldId: 'orderstatus', value: "B" }); // 2 = Aprobado
        salesOrder.setValue({ fieldId: 'custbody_sdb_ticket_group', value: ticketGroup });
        salesOrder.setValue({ fieldId: 'custbody_sdb_created_from', value: true });
        salesOrder.setValue({ fieldId: 'custbody_sdb_airline_related', value: airline.aerolinea });
        salesOrder.setValue({ fieldId: 'custbody_sdb_airline_code', value: airline.code });
        salesOrder.setValue({ fieldId: 'custbody_sdb_origen', value: requestBody.domInt }); //origen de aerolinea

        tickets.forEach(function (ticket) { //por cada boleto creo un grupo con sus taxes
            const startLine = salesOrder.getLineCount({ sublistId: 'item' });
            salesOrder.selectNewLine({ sublistId: 'item' });
            salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: 264 });
            salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
            salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: `Boleto ${ticket.boleto} - Pasajero: ${ticket.pasajero}` });
            salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_ticket_number', value: ticket.boleto });
            salesOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_ticket_route', value: rutasStr });
            salesOrder.commitLine({ sublistId: 'item' });
            const endLine = salesOrder.getLineCount({ sublistId: 'item' });
            setValuesToChargeItems(requestBody, salesOrder, ticket, startLine, endLine);//Se cargan los valores en los items de recargo por cada boleto
        });

        var salesOrderId;

        if (customer.customerCalendary) {//si tiene calendario de facturacion entonces creamos la orden cerrada
            closeOrder(salesOrder)
            salesOrderId = salesOrder.save();
            log.debug("#####Sales Order creada URL ", "https://11341630-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=" + salesOrderId + "&whence=");
        }
        else { //Entonces facturamos al momento 
            salesOrderId = salesOrder.save();
            log.debug("#####Sales Order creada URL ", "https://11341630-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=" + salesOrderId + "&whence=");
            createInvoice(salesOrderId, ticketGroup, requestBody);
        }
        return salesOrderId;
    }

    function createInvoice(salesOrderId, ticketGroup, requestBody) {
        var invoice = record.transform({
            fromType: record.Type.SALES_ORDER,
            fromId: salesOrderId,
            toType: record.Type.INVOICE,
            isDynamic: true
        });

        invoice.setValue({ fieldId: 'custbody_sdb_ticket_group', value: ticketGroup });

        var invoiceId = invoice.save();
        log.debug('Factura de venta creada', invoiceId);

        createCustomerPayment(invoiceId, requestBody)
        return invoiceId;
    }

    //crea invoice desde la subsidiaria actual hacia la subsidiaria del cliente 
    function createIntercompanyInvoice(requestBody, subsidiaryId, customerSubsidiaryId, ticketGroup) {
        var tickets = requestBody.boletos || [];
        var subsidiaryRepresentativeId = getSubsidiaryClientRepresentative(subsidiaryId);
        var subsidiaryRepresentativeCustomerId = getSubsidiaryClientRepresentative(customerSubsidiaryId);

        log.debug(" subsidiaryRepresentativeId es " + subsidiaryRepresentativeId)
        log.debug(" subsidiaryRepresentativeCustomerId es " + subsidiaryRepresentativeCustomerId)

        // Si es intercompany: Invoice desde la subsidiaria actual hacia la del cliente
        var intercompanyInvoice = record.create({
            type: record.Type.INVOICE,
            isDynamic: true
        });

        intercompanyInvoice.setValue({ fieldId: 'entity', value: subsidiaryRepresentativeCustomerId });
        intercompanyInvoice.setValue({ fieldId: 'subsidiary', value: subsidiaryId });
        intercompanyInvoice.setValue({ fieldId: 'custbody_sdb_ticket_group', value: ticketGroup });
        intercompanyInvoice.setValue({ fieldId: 'custbody_sdb_created_from', value: true });

        tickets.forEach(function (ticket) {
            const startLine = intercompanyInvoice.getLineCount({ sublistId: 'item' });

            intercompanyInvoice.selectNewLine({ sublistId: 'item' });
            intercompanyInvoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: 264 });
            intercompanyInvoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
            intercompanyInvoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: `Boleto ${ticket.boleto} - Pasajero: ${ticket.pasajero}` });
            intercompanyInvoice.commitLine({ sublistId: 'item' });

            const endLine = intercompanyInvoice.getLineCount({ sublistId: 'item' });
            setValuesToChargeItems(requestBody, intercompanyInvoice, ticket, startLine, endLine);
        });

        var intercompanyInvoiceId = intercompanyInvoice.save();
        log.debug("Factura Intercompany creada", intercompanyInvoiceId);
        log.debug("##### URL de la factura intercompany: ", "https://11341630-sb1.app.netsuite.com/app/accounting/transactions/custinvc.nl?id=" + intercompanyInvoiceId + "&whence=");
        return intercompanyInvoiceId;
    }

    //Logica que identifica cuentas, montos y subsidiaria para realizar el pago
    function createCustomerPayment(invoiceId, requestBody) {
        let totalTc = 0;
        let totalCash = 0;

        // Recorrer boletos buscando montos de efectivo y tarjeta
        requestBody.boletos.forEach(ticket => {
            totalTc += parseFloat(ticket.pagotc || 0);
            totalCash += parseFloat(ticket.pagocash || 0);
        });

        log.debug('Totales', `TC: ${totalTc} | Cash: ${totalCash}`);

        // Si es pago combinado (ambos > 0)
        if (totalCash > 0 && totalTc > 0) {
            // Verifica que se pueda pagar una parte en efectivo
            if (totalCash > 0) {
                createPayment(invoiceId, totalCash, 'efectivo');
            }

            // Verifica que se pueda pagar una parte con tarjeta
            if (totalTc > 0) {
                createPayment(invoiceId, totalTc, 'tarjeta');
            }

        } else {
            // Caso simple: solo efectivo o solo tarjeta
            if (totalCash > 0) {
                createPayment(invoiceId, totalCash, 'efectivo');
            }
            if (totalTc > 0) {
                createPayment(invoiceId, totalTc, 'tarjeta');
            }
        }
    }

    //Crea un pago con el monto y método especificado
    function createPayment(invoiceId, amount, metodo) {

        const PAYMENT_ACCOUNTS = {
            2: { //Casa de incentivos
                efectivo: 428,
                tarjeta: 428
            },
            3: { //Vallejo
                efectivo: 433,
                tarjeta: 428
            }
        };

        const payment = record.transform({
            fromType: record.Type.INVOICE,
            fromId: invoiceId,
            toType: record.Type.CUSTOMER_PAYMENT,
            isDynamic: true
        });

        const subsidiaryId = payment.getValue({ fieldId: 'subsidiary' });
        const accountId = PAYMENT_ACCOUNTS[subsidiaryId]?.[metodo];

        if (!accountId) {
            log.error('Cuenta no encontrada', `Subsidiaria ${subsidiaryId} - Método ${metodo}`);
            return null;
        }

        // Asignamos cuenta y monto
        payment.setValue({ fieldId: 'account', value: accountId });
        payment.setValue({ fieldId: 'payment', value: amount });
        payment.setValue({ fieldId: 'memo', value: `Pago automático - ${metodo}` });

        // Aplicar el pago a la invoice
        const lineCount = payment.getLineCount({ sublistId: 'apply' });
        for (let i = 0; i < lineCount; i++) {
            const appliedInvoiceId = payment.getSublistValue({
                sublistId: 'apply',
                fieldId: 'internalid',
                line: i
            });
            if (appliedInvoiceId == invoiceId) {
                payment.selectLine({ sublistId: 'apply', line: i });
                payment.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'apply', value: true });
                payment.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'amount', value: amount });
                payment.commitLine({ sublistId: 'apply' });
            }
        }

        const paymentId = payment.save();
        log.debug(`Customer Payment ${metodo.toUpperCase()} creado`, `ID: ${paymentId} | Monto: ${amount}`);
        return paymentId;
    }

    function findCustomer(remarks, subsidiary) {
        if (!remarks || !Array.isArray(remarks)) return null;
        var customerRuc = null;

        for (let i = 0; i < remarks.length; i++) {
            const detalle = remarks[i].detalle;
            if (!detalle) continue;

            // Buscar patrón IDFAC*
            if (detalle.includes("IDFAC*")) {
                const match = detalle.match(/IDFAC\*(\d{5,15})/);
                if (match) {
                    customerRuc = match[1].trim();
                    break;
                }
            }

            // Buscar patrón RM*NC-
            if (detalle.includes("RM*NC-")) {
                const match = detalle.match(/RM\*NC-(\d{5,15})/);
                if (match) {
                    customerRuc = match[1].trim();
                    break;
                }
            }
        }

        if (customerRuc) {
            var customerSearch = search.create({
                type: search.Type.CUSTOMER,
                filters: [
                    ['vatregnumber', 'is', customerRuc]
                ],
                columns: ['internalid', 'subsidiary', 'category', 'custentity_sdb_billing_calendar']
            });

            var result = customerSearch.run().getRange({ start: 0, end: 1 });

            if (result.length > 0) {
                var customerId = result[0].getValue({ name: 'internalid' });
                var customerSubsidiary = result[0].getValue({ name: 'subsidiary' });
                var customerCategory = result[0].getValue({ name: 'category' });
                var customerCalendary = result[0].getValue({ name: 'custentity_sdb_billing_calendar' });

                log.debug('Cliente encontrado', `ID: ${customerId}, Subsidiaria: ${customerSubsidiary}, Categoría: ${customerCategory}, Calendary: ${customerCalendary}`);
                return {
                    customerId: parseInt(customerId),
                    subsidiaryId: parseInt(customerSubsidiary),
                    customerCategory: parseInt(customerCategory),
                    customerCalendary: customerCalendary
                };
            }
            if (result.length === 0) {// Si no lo encuentra, lo crea
                var newCustomer = record.create({
                    type: record.Type.CUSTOMER,
                    isDynamic: true
                });

                newCustomer.setValue({ fieldId: 'companyname', value: customerRuc }); //lo crea usando el ruc como nombre 
                newCustomer.setValue({ fieldId: 'subsidiary', value: subsidiary });
                newCustomer.setValue({ fieldId: 'vatregnumber', value: customerRuc });
                newCustomer.setValue({ fieldId: 'category', value: 1 }); //categoria 

                var customerId = newCustomer.save();
                log.debug('Se creó el cliente', customerId);

                return {
                    customerId: customerId,
                    subsidiaryId: subsidiary
                };
            }
        }
        else {
            throw new Error('No se encontró el RUC del cliente en los remarks. No se procesará la solicitud');
        }
    }

    function checkSubsidiary(iataCode) {
        if (!iataCode) {
            log.debug('Código IATA no presente en Ticket');
            return false;
        }
        var subsidiarySearch = search.create({
            type: search.Type.SUBSIDIARY,
            filters: [
                ['custrecord_sdb_iatacode', 'contains', iataCode]
            ],
            columns: ['internalid']
        });

        var result = subsidiarySearch.run().getRange({ start: 0, end: 1 });

        if (result.length > 0) {
            var subsidiaryId = result[0].getValue({ name: 'internalid' });
            log.debug('Subsidiaria encontrada', subsidiaryId);
            return subsidiaryId;
        } else {
            throw new Error(`No se encontró subsidiaria con el código IATA ${iataCode}`);
        }
    }

    function getSubsidiaryClientRepresentative(subsidiaryId) {
        var result = search.lookupFields({
            type: search.Type.SUBSIDIARY,
            id: subsidiaryId,
            columns: ['representingcustomer']
        });

        var customerRep = result.representingcustomer && result.representingcustomer[0]
            ? result.representingcustomer[0].value
            : null;

        if (!customerRep) {
            throw new Error('No se encontró cliente representante para la subsidiaria ID: ' + subsidiaryId);
        }
        return customerRep;
    }


    function addCommission(requestBody, order, ticket, endLine) {
        var orig = requestBody.domInt;
        var line = endLine;

        if (ticket.comision > 0) {
            if (orig == "I") { //Si es internacional comision internacional 
                insertItem(order, line, 283, ticket.comision)
            }
            else if (orig == "D") { //si es local comision nacional 
                insertItem(order, line, 282, ticket.comision)
            }
        }
        else {
            return false;
        }
    }

    function setValuesToChargeItems(requestBody, order, ticket, startLine, endLine) {
        deleteItem(order, -3, startLine, endLine) //elimino el item que inicializa el grupo 
        var baseTaxEc = ((ticket.taxec * 100) / 15);
        let lineNumber = startLine + 1;

        if (ticket.taxcombustible <= 0) {
            if (baseTaxEc == ticket.tarifa) {
                insertItem(order, lineNumber, 281, ticket.tarifa)
                lineNumber++
            }
            else {
                insertItem(order, lineNumber, 281, baseTaxEc)//Agregar Boleto con iva por la base del ec 
                lineNumber++;
                insertItem(order, lineNumber, 263, (ticket.tarifa - baseTaxEc)) //Agregar Boleto sin iva por la diferencia entre la Base del ec y la tarifa del boleto 
                lineNumber++
            }
        }
        else {
            if (baseTaxEc == (ticket.tarifa + ticket.taxcombustible)) {//Ambos tienen iva 
                insertItem(order, lineNumber, 281, ticket.tarifa)//Agregar Boleto con iva
                lineNumber++;
                insertItem(order, lineNumber, 279, ticket.taxcombustible)//Agregar combustible con iva 
                lineNumber++
            }
            else { //Entonces el ec corresponde al boleto o el combustible 

                if (baseTaxEc == ticket.tarifa) {
                    insertItem(order, lineNumber, 281, ticket.tarifa) // Agregar Boleto con iva
                    lineNumber++;
                    insertItem(order, lineNumber, 280, ticket.taxcombustible) //Agregar combustible sin iva 
                    lineNumber++
                }
                else if (baseTaxEc == ticket.taxcombustible) {
                    insertItem(order, lineNumber, 263, ticket.tarifa) //Agregar Boleto sin iva
                    lineNumber++;
                    insertItem(order, lineNumber, 279, ticket.taxcombustible) //Agregar combustible con iva 
                    lineNumber++
                }
                else if (baseTaxEc == 0) {
                    insertItem(order, lineNumber, 263, ticket.tarifa) //Agregar Boleto sin iva
                    lineNumber++
                    insertItem(order, lineNumber, 280, ticket.taxcombustible)//Agregar combustible sin iva
                    lineNumber++
                }
            }
        }

        insertItem(order, lineNumber, 277, ticket.taxec)
        lineNumber++;
        insertItem(order, lineNumber, 276, ticket.taxed)
        lineNumber++;
        insertItem(order, lineNumber, 278, ticket.taxotro)
        lineNumber++

        addCommission(requestBody, order, ticket, lineNumber)
    }

    function insertItem(order, line, itemId, rate) {
        order.insertLine({ sublistId: 'item', line });
        order.selectLine({ sublistId: 'item', line });
        order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemId });
        order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
        order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: rate });
        order.commitLine({ sublistId: 'item' });
    }

    function deleteItem(order, itemDeleteId, startLine, endLine) {
        for (let i = endLine - 1; i >= startLine; i--) {
            var itemId = parseInt(order.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            }));
            if (itemId == itemDeleteId) {
                order.removeLine({
                    sublistId: 'item',
                    line: i
                });
            }

        }
    }

    function closeOrder(order) {
        var lines = order.getLineCount({ sublistId: 'item' });

        for (var i = 0; i < lines; i++) {
            var itemType = order.getSublistValue({
                sublistId: 'item',
                fieldId: 'itemtype',
                line: i
            });

            if (itemType === 'EndGroup') continue;

            order.selectLine({ sublistId: 'item', line: i });
            order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'isclosed', value: true });
            order.commitLine({ sublistId: 'item' });
        }
    }

    function getVendor(vendorName) {
        const vendorSearch = search.create({
            type: search.Type.VENDOR,
            filters: [
                ['entityid', 'contains', vendorName]
            ],
            columns: ['internalid']
        });

        let vendorId = null;

        vendorSearch.run().each(function (result) {
            vendorId = result.getValue({ name: 'internalid' });
            return false; // solo el primero
        });
        if (vendorId != null) { return vendorId; }
        else { return 3012 } //default vendor 
    }

    function markReferenceTickets(boletoData, type) {
        boletoData.forEach(function ({ oldNumber, newId }) {
            // Buscar el ID del registro del boleto por número
            const oldBoletoSearch = search.create({
                type: 'customrecord_boleto',
                filters: [
                    ['custrecord_numeroboleto', 'is', oldNumber]
                ],
                columns: ['internalid']
            });

            const results = oldBoletoSearch.run().getRange({ start: 0, end: 1 });

            if (results.length > 0) {
                const oldBoletoId = results[0].getValue('internalid');

                if (type == 'EX') {
                    record.submitFields({
                        type: 'customrecord_boleto',
                        id: oldBoletoId,
                        values: {
                            custrecord_sdb_edited_ticket: true,
                            custrecord_sdb_new_ticket_exchange: newId  //Referencia al boleto nuevo EXCHANGE
                        }
                    });

                    record.submitFields({
                        type: 'customrecord_boleto',
                        id: newId,
                        values: {
                            custrecord_exchange: oldBoletoId  //Referencia al boleto viejo el cual recibió Exchange
                        }
                    });

                    log.debug('Boletos marcados como modificados', oldBoletoId, newId);
                }
                else { //Es un emd 
                    record.submitFields({
                        type: 'customrecord_boleto',
                        id: oldBoletoId,
                        values: {
                            custrecord_sdb_edited_ticket: true,
                            custrecord_sdb_emd_reference: newId  //Referencia al boleto nuevo EMD
                        }
                    });

                    record.submitFields({
                        type: 'customrecord_boleto',
                        id: newId,
                        values: {
                            custrecord_emdnumero: oldBoletoId  //Referencia al boleto viejo el cual recibió EMD
                        }
                    });

                    log.debug('Boletos marcados como modificados', oldBoletoId, newId);
                }

            } else {
                throw new Error('Boleto no encontrado ' + oldNumber);
            }
        });
    }

    //Busca el customer y subsidiaria que tenia asignado el boleto anterior para asignar a los emd.
    function findDataEmd(boletoID) {
        //Boleto -> grupo
        var boletoRes = search.create({
            type: 'customrecord_boleto',
            filters: ['custrecord_numeroboleto', 'is', boletoID],
            columns: ['custrecord_grupo']
        }).run().getRange({ start: 0, end: 1 });

        if (!boletoRes || !boletoRes.length) {
            return null;
        }

        var groupId = boletoRes[0].getValue('custrecord_grupo');
        if (!groupId) {
            return null;
        }

        // Grupo -> cliente 
        var groupData = search.lookupFields({
            type: 'customrecord_grupoboletos',
            id: groupId,
            columns: ['custrecord_sdb_customer']
        });

        var customerId = Array.isArray(groupData.custrecord_sdb_customer) &&
            groupData.custrecord_sdb_customer[0]
            ? groupData.custrecord_sdb_customer[0].value
            : null;

        if (!customerId) {
            return null
        }

        //Cliente -> subsidiaria
        var custData = search.lookupFields({
            type: 'customer',
            id: customerId,
            columns: ['subsidiary']
        });

        var subsidiaryId = Array.isArray(custData.subsidiary) &&
            custData.subsidiary[0]
            ? custData.subsidiary[0].value
            : null;

        return { customerId: customerId, subsidiaryId: subsidiaryId };
    }

    function createCards(cardObj, ticketId) {
        const cards = cardObj || [];
        cards.forEach(card => {
            var cardRecord = record.create({
                type: "customrecord_sdb_card_record",
                isDynamic: true
            });
            cardRecord.setValue({ fieldId: 'custrecord_sdb_parent_ticket', value: ticketId });
            cardRecord.setValue({ fieldId: 'name', value: card.id });
            cardRecord.setValue({ fieldId: 'custrecord_sdb_card_id', value: card.id });
            cardRecord.setValue({ fieldId: 'custrecord_sdb_card_tcempresa', value: card.tcEmpresa });
            cardRecord.setValue({ fieldId: 'custrecord_sdb_card_tcautorizacion', value: card.tcAutorizacion });
            cardRecord.setValue({ fieldId: 'custrecord_sdb_card_tcvalor', value: card.tcValor });
            cardRecord.save();
        });
    }

    function logError(e, context = {}) {
        try {
            const errorLog = record.create({
                type: 'customrecord_sdb_error_log',
                isDynamic: true
            });

            errorLog.setValue({ fieldId: 'name', value: `Error en ${context.module || 'Sin módulo'} - ${new Date().toISOString()}` });
            errorLog.setValue({ fieldId: 'custrecord_sdb_error_fecha', value: new Date() });
            errorLog.setValue({ fieldId: 'custrecord_sdb_error_modulo', value: context.module || 'Sin nombre' });
            errorLog.setValue({ fieldId: 'custrecord_sdb_error_msg', value: e.message || 'Error sin mensaje' });
            errorLog.setValue({ fieldId: 'custrecord_sdb_error_stack', value: e.stack || 'Sin stack trace' });

            if (context.relatedId !== undefined && context.relatedId !== null) {
                errorLog.setValue({ fieldId: 'custrecord_sdb_id_solicitud', value: context.relatedId.toString() });
            }
            if (context.bodyRequest !== undefined && context.bodyRequest !== null) {
                errorLog.setValue({ fieldId: 'custrecord_sdb_body_request', value: context.bodyRequest.toString() });
            }

            const id = errorLog.save();
            log.error(e.message)
            log.debug('Error registrado en customrecord_error_log', id);

            return id;
        } catch (error) {
            throw new Error('Error en logError: ', error);
        }
    }

    return {
        post: post
    };
});
