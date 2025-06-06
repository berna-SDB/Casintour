/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

define(['N/record', 'N/search', 'N/error'], function (record, search, error) {

    function post(requestBody) {
        try {
            var salesOrderId = createSalesOrder(requestBody);
            var ticketGroup = createTicketGroup(requestBody, salesOrderId);
            createTicket(requestBody, ticketGroup);
            createInvoice(salesOrderId); //Se puede llamar desde createSalesOrder

        } catch (error) {
            log.error('ERROR Post', error);
        }
    }

    function createTicket(requestBody, ticketGroupId) { //Crea Boleto 
        try {
            requestBody.boletos.forEach(function (ticket) {

                var newTicketRecord = record.create({
                    type: "customrecord_boleto",
                    isDynamic: true
                });
                newTicketRecord.setValue({ fieldId: 'custrecord_grupo', value: ticketGroupId });
                newTicketRecord.setValue({ fieldId: 'name', value: `Boleto ${ticket.id}` });
                newTicketRecord.setValue({ fieldId: 'custrecord_idboleto', value: ticket.id });
                newTicketRecord.setValue({ fieldId: 'custrecord_idaerolinea', value: ticket.aerolinea.id });
                newTicketRecord.setValue({ fieldId: 'custrecord_codigoaerolinea', value: ticket.aerolinea.code });
                newTicketRecord.setValue({ fieldId: 'custrecord_aerolinea', value: ticket.aerolinea.aerolinea });
                newTicketRecord.setValue({ fieldId: 'custrecord_iniciales', value: ticket.aerolinea.iniciales });
                newTicketRecord.setValue({ fieldId: 'custrecord_origen', value: ticket.aerolinea.origen });
                newTicketRecord.setValue({ fieldId: 'custrecord_codigodegrupo', value: ticket.aerolinea.codeGroup });
                newTicketRecord.setValue({ fieldId: 'custrecord_numeroboleto', value: ticket.boleto });
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
                newTicketRecord.setValue({ fieldId: 'custrecord_exchange', value: ticket.exchange });
                newTicketRecord.setValue({ fieldId: 'custrecord_emdnumero', value: ticket.emdnumero });
                newTicketRecord.setValue({ fieldId: 'custrecord_numero', value: ticket.numero });
                newTicketRecord.setValue({ fieldId: 'custrecord_numpasajero', value: ticket.numPasajero });
                newTicketRecord.setValue({ fieldId: 'custrecord_comision', value: ticket.comision });

                var boletoId = newTicketRecord.save();
                log.debug('Boleto creado', 'ID: ' + boletoId);
            });

        } catch (error) {
            log.error('ERROR CreateTicket', error);
            return;
        }
    }

    function createTicketGroup(requestBody, salesOrderId) { //crea el grupo de boletos y las rutas.
        try {
            var newTicketGroup = record.create({
                type: "customrecord_grupoboletos",
                isDynamic: true
            });

            newTicketGroup.setValue({ fieldId: 'name', value: `Grupo de boletos ${requestBody.id}` });
            newTicketGroup.setValue({ fieldId: 'custrecord_ovasociada', value: salesOrderId });
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

            // Crear rutas
            var routes = requestBody.routings || [];
            for (var route of routes) {
                var newRoute = record.create({
                    type: "customrecord_ruta",
                    isDynamic: true
                });
                newRoute.setValue({ fieldId: 'name', value: `Ruta ${route.numero} del grupo ${requestBody.id}` });
                newRoute.setValue({ fieldId: 'custrecord_grupoboletosruta', value: ticketGroup });
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

                newRoute.save();
            }
            log.debug('Grupo de boletos creado');
            log.debug('Rutas de boleto creadas');
            return ticketGroup;

        } catch (e) {
            log.error('Error en createTicketGroup', e);
            throw e;
        }
    }

    function createSalesOrder(requestBody) {
        try {
            var tickets = requestBody.boletos || [];
            var subsidiaryId = checkSubsidiary(tickets); //Busco el id de subsidiaria del primer boleto.

            if (!subsidiaryId) {
                throw new Error('No se encontró una subsidiaria para el código IATA: ' + tickets[0].codigoIata);
            }

            var customerRuc = requestBody.empresa;
            var customer = findCustomer(customerRuc, subsidiaryId);
            var customerId = customer.customerId;
            var customerSubsidiaryId = customer.subsidiaryId;

            if (customerSubsidiaryId != subsidiaryId) //Caso de intercompany. Se genera Sale Order desde la subsidiraria actual a la subsidiaria que pertenece el cliente y desde la subsidiaria al que pertenece el cliente se genera Sale Order al cliente 
            {
                var subsidiaryRepresentativeClientId = getSubsidiaryClientRepresentative(customerSubsidiaryId)

                var salesOrder = record.create({
                    type: record.Type.SALES_ORDER,
                    isDynamic: true
                });

                salesOrder.setValue({ fieldId: 'entity', value: subsidiaryRepresentativeClientId });
                salesOrder.setValue({ fieldId: 'subsidiary', value: subsidiaryId });
                salesOrder.setValue({ fieldId: 'approvalstatus', value: 2 }); // 2 = Aprobado

                tickets.forEach(function (ticket) {
                    salesOrder.selectNewLine({ sublistId: 'item' });

                    salesOrder.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: 6 // ID del ítem genérico
                    });

                    salesOrder.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: 1
                    });

                    salesOrder.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: ticket.total || 1
                    });

                    salesOrder.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'description',
                        value: `Boleto ${ticket.id} - Pasajero: ${ticket.pasajero}`
                    });

                    salesOrder.commitLine({ sublistId: 'item' });
                });

                var salesOrderId = salesOrder.save();
                log.debug("Sales Order Intercompany creada", salesOrderId);

                createInvoice(salesOrderId);
            }

            var salesOrder = record.create({   //Creo la Sale order desde la subsidiaria del cliente al cliente final.
                type: record.Type.SALES_ORDER,
                isDynamic: true
            });

            salesOrder.setValue({ fieldId: 'entity', value: customerId });
            salesOrder.setValue({ fieldId: 'subsidiary', value: customerSubsidiaryId }); //Asigno subsidiaria a la que pertenece el cliente.
            salesOrder.setValue({ fieldId: 'approvalstatus', value: 2 }); // 2 = Aprobado

            tickets.forEach(function (ticket) {
                salesOrder.selectNewLine({ sublistId: 'item' });

                salesOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: 6 // ID del ítem genérico
                });

                salesOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: 1
                });

                salesOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: ticket.total || 1
                });

                salesOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'description',
                    value: `Boleto ${ticket.id} - Pasajero: ${ticket.pasajero}`
                });

                salesOrder.commitLine({ sublistId: 'item' });
            });

            var salesOrderId = salesOrder.save();
            log.debug("Sales Order creada", salesOrderId);
            return salesOrderId;

        } catch (e) {
            log.error("Error createSalesOrder", e);
            throw e;
        }
    }

    function createInvoice(salesOrderId) {
        try {
            var invoice = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: salesOrderId,
                toType: record.Type.INVOICE,
                isDynamic: true
            });

            var invoiceId = invoice.save();

            log.debug('Factura creada', invoiceId);
            return invoiceId;

        } catch (e) {
            log.error('Error en createInvoice', e);
            throw e;
        }
    }

    function findCustomer(customerRuc, subsidiary) {
        try {
            var customerSearch = search.create({
                type: search.Type.CUSTOMER,
                filters: [
                    ['vatregnumber', 'is', customerRuc]
                ],
                columns: ['internalid', 'subsidiary']
            });

            var result = customerSearch.run().getRange({ start: 0, end: 1 });

            if (result.length > 0) {
                var customerId = result[0].getValue({ name: 'internalid' });
                var customerSubsidiary = result[0].getValue({ name: 'subsidiary' });

                log.debug('Cliente encontrado', `ID: ${customerId}, Subsidiaria: ${customerSubsidiary}`);
                return {
                    customerId: parseInt(customerId),
                    subsidiaryId: parseInt(customerSubsidiary)
                };
            }

            // Si no lo encuentra, lo crea
            var newCustomer = record.create({
                type: record.Type.CUSTOMER,
                isDynamic: true
            });

            newCustomer.setValue({ fieldId: 'entityid', value: customerRuc });
            newCustomer.setValue({ fieldId: 'custentity_ruc', value: customerRuc });
            newCustomer.setValue({ fieldId: 'subsidiary', value: subsidiary });

            var customerId = newCustomer.save();
            log.debug('Cliente creado', customerId);

            return {
                customerId: customerId,
                subsidiaryId: subsidiary
            };

        } catch (e) {
            log.error('Error findCustomer', e);
            throw e;
        }
    }

    function checkSubsidiary(tickets) {
        var iataCode = tickets[0].codigoIata;

        if (!iataCode) {
            throw new Error('Código IATA no presente en Ticket');
        }
        try {

            var subsidiarySearch = search.create({
                type: search.Type.SUBSIDIARY,
                filters: [
                    ['custrecord_sdb_iatacode', 'is', iataCode] //Modificar id de campo
                ],
                columns: ['internalid']
            });

            var result = subsidiarySearch.run().getRange({ start: 0, end: 1 });

            if (result.length > 0) {
                var subsidiaryId = result[0].getValue({ name: 'internalid' });
                log.debug('Subsidiaria encontrada', subsidiaryId);
                return subsidiaryId;
            } else {
                log.debug('No se encontro subsidiaria con el codigo Iata ' + iataCode);
                //return 0;
            }

            return 2;

        } catch (e) {
            log.error('Error en checkSubsidiary', e);
            throw e;
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
            return 'No se encontró cliente representante para la subsidiaria ID: ' + subsidiaryId;
        }

        return customerRep;
    }
    return {
        post: post
    };
});
