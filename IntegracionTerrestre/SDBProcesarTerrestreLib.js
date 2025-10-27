/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @FileName SDB_ProcesarTerrestreLib.js
 * @Description Estructura de librería para procesamiento de procesos terrestre.
 */

define(['N/record', 'N/search', 'N/error'], function (record, search, error) {

    function processRequest(requestBody) {
        try {
            var history = createHistory(requestBody)
            const ticketType = requestBody.tipoTicket;
            switch (ticketType) {
                case "EX":
                    log.debug("Procesando Boleto tipo EX");
                    var subsidiaryId = checkSubsidiary(requestBody.empresa);
                    break;
                case "EMD":
                    var subsidiaryId = checkSubsidiary(requestBody.empresa);
                    break;
                case "ET": // Lógica para Boleto común
                    var subsidiaryId = checkSubsidiary(requestBody.empresa);
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
            }, history);
            return {
                success: false,
                message: error.message || 'Error',
            }
        }
    }

    //Crea Factura de compra intercompany
    function createPurchaseIntercompanyBill(requestBody, customerSubsidiaryId, ticketGroup, subsidiaryId) {
        var tickets = requestBody.boletos || [];

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

            const endLine = billIntercompanyRecord.getLineCount({ sublistId: 'item' });
            setValuesToChargeItems(billIntercompanyRecord, ticket, startLine, endLine);
        });

        var billIntercompanyId = billIntercompanyRecord.save();
        log.debug('Factura intercompany creada', billIntercompanyId);

        return billIntercompanyId;
    }

    function createSalesOrder(requestBody, customer, ticketGroup) {
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

        //createCustomerPayment(invoiceId, requestBody)
        return invoiceId;
    }

    //crea invoice desde la subsidiaria actual hacia la subsidiaria del cliente 
    function createIntercompanyInvoice(requestBody, subsidiaryId, customerSubsidiaryId, ticketGroup) {
    }

    //Logica que identifica cuentas, montos y subsidiaria para realizar el pago
    function createCustomerPayment(invoiceId, requestBody) {
    }

    //Crea un pago con el monto y método especificado
    function createPayment(invoiceId, amount, metodo) {
    }

    function findCustomer(remarks, subsidiary) {
        if (!remarks || !Array.isArray(remarks)) throw new Error("No se encontró el campo remarks. No se procesará la solicitud");
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

    function calculateCommissions(requestBody, salesOrder) { //Se encarga solo de carcular la comision bsp y comision mym (el fee es una comision que va como articulo, estas comisiones son informativas)
    }

    function createEmptySalesOrder(baseSalesOrderData, ticketGroup) {
    }

    function createHistory(requestBody) {
        var history = record.create({
            type: "customrecord_sdb_history_request",
            isDynamic: true
        });
        history.setValue({ fieldId: 'name', value: `Solicitud ${requestBody.id} ` });
        history.setValue({ fieldId: 'custrecord_sdb_request_id', value: requestBody.id });
        history.setValue({ fieldId: 'custrecord_sdb_request_json', value: JSON.stringify(requestBody) });

        var historyCreated = history.save();
        if (historyCreated) {
            log.debug(`historial creado para la solicitud ${requestBody.id} `, historyCreated);
        }
        else {
            log.error('Error en createHistory')
        }
        return historyCreated;
    }

    function logError(e, context = {}, history) {
        try {
            const errorLog = record.create({
                type: 'customrecord_sdb_error_log',
                isDynamic: true
            });
            errorLog.setValue({ fieldId: 'name', value: `Error en solicitud ${context.relatedId.toString()} - ${new Date().toISOString()}` });
            errorLog.setValue({ fieldId: 'custrecord_sdb_error_fecha', value: new Date() });
            errorLog.setValue({ fieldId: 'custrecord_sdb_error_modulo', value: context.module || 'Sin nombre' });
            errorLog.setValue({ fieldId: 'custrecord_sdb_error_msg', value: JSON.stringify(e.message) || 'Error sin mensaje' });
            errorLog.setValue({ fieldId: 'custrecord_sdb_error_stack', value: JSON.stringify(e.stack) || 'Sin stack trace' });
            errorLog.setValue({ fieldId: 'custrecord_sdb_history_related', value: history });

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
        processRequest: processRequest
    };
});