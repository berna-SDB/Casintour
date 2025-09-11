/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/https', 'N/ui/message', 'N/url', 'N/runtime', 'N/log', './SDBCreacionDeBoletoLib'],
    function (serverWidget, record, search, https, message, url, runtime, log, BoletoLib) {

        function onRequest(context) {
            if (context.request.method === 'POST') {
                var data = JSON.parse(context.request.body || '{}');

                const recId = Number(data.recId);
                if (!recId) { context.response.write('recId requerido.'); return; }

                const recObj = record.load({ type: 'customrecord_sdb_history_request', id: recId });
                const ticketGroupId = recObj.getValue('custrecord_sdb_request_id');
                var requestBody = recObj.getValue('custrecord_sdb_request_json');
                requestBody = JSON.parse(requestBody);


                try {
                    deleteRelatedRecords(ticketGroupId); //Eliminar registros relacionados
                    context.response.write('Se eliminaron los registros');


                    var groupSearch = search.create({
                        type: 'customrecord_grupoboletos',
                        filters: [['internalid', 'is', ticketGroupId]], // el id del request original
                        columns: ['internalid']
                    }).run().getRange({ start: 0, end: 1 });

                    if (groupSearch.length === 0) { //Si efectivamente se eliminaron todos los registros, volver a ejecutar la solicitud.
                        const result = BoletoLib.processRequest(requestBody);//Volver a ejecutar solicitud
                        log.debug('Resultado de vovler a ejecutar solicitud', result);
                        context.response.write(JSON.stringify(result));

                    }

                } catch (e) {
                    log.error('Error eliminando registros', e);
                    context.response.write('Error eliminando registros: ' + e.message);
                    return;
                }
            }
        }

        function deleteRelatedRecords(ticketGroup) {
            var deletedId = [];
            var groupSearch = search.create({
                type: 'customrecord_grupoboletos',
                filters: [['custrecord_iddocumento', 'is', ticketGroup]], // el id del request original
                columns: ['internalid']
            }).run().getRange({ start: 0, end: 1 });

            if (!groupSearch || groupSearch.length === 0) {
                context.response.write('No se encontro grupo de boletos para el ID ' + ticketGroup);
                return
            }
            var ticketGroupId = groupSearch[0].getValue('internalid');

            // Buscar facturas
            var invoiceSearch = search.create({
                type: search.Type.INVOICE,
                filters: [['custbody_sdb_ticket_group', 'is', ticketGroupId], 'and', ['mainline', 'is', 'T']],
                columns: ['internalid']
            }).run().getRange({ start: 0, end: 1000 });
            log.debug('Cantidad de facturas encontradas', invoiceSearch.length);

            //Por cada invoice busco los pagos aplicados a la factura
            invoiceSearch.forEach(function (invRes) {
                var invoiceId = invRes.getValue('internalid')
                var paymentSearch = search.create({
                    type: "transaction",
                    settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                    filters:
                        [
                            ["recordtype", "is", "customerpayment"],
                            "AND",
                            ["appliedtotransaction", "anyof", invoiceId]
                        ],
                    columns: [search.createColumn({ name: 'internalid' })]
                });

                var results = paymentSearch.run().getRange({ start: 0, end: 1000 });

                //Elimino cada pago
                results.forEach(function (pay) {
                    var payId = pay.getValue({ name: 'internalid' });
                    log.debug('ID del pago asociado es ' + payId)
                    if (payId) {
                        deletedId.push(payId)
                        record.delete({ type: record.Type.CUSTOMER_PAYMENT, id: payId });
                    }
                });
            });

            //Eliminar facturas (Invoice)
            invoiceSearch.forEach(function (invRes) {
                if (invRes) {
                    var invoiceId = invRes.getValue('internalid')
                    deletedId.push(invoiceId)
                    record.delete({ type: search.Type.INVOICE, id: invoiceId });
                }
            });

            //Eliminar Sales Orders
            var soSearch = search.create({
                type: search.Type.SALES_ORDER,
                filters: [['custbody_sdb_ticket_group', 'is', ticketGroupId], 'and', ['mainline', 'is', 'T']],
                columns: search.createColumn({ name: 'internalid', summary: search.Summary.GROUP })
            }).run().getRange({ start: 0, end: 1000 });

            log.debug('Cantidad de Sales Orders', soSearch.length);

            soSearch.forEach(function (soRes) {
                var saleOrderId = soRes.getValue({ name: 'internalid', summary: search.Summary.GROUP });
                if (saleOrderId) {
                    deletedId.push(saleOrderId)
                    log.debug('Las sale order son ' + saleOrderId)
                    record.delete({ type: search.Type.SALES_ORDER, id: saleOrderId });
                }

            });

            // Buscar boletos del grupo y borrar las tarjetas asociadas
            var boletoSearch = search.create({
                type: 'customrecord_boleto',
                filters: [['custrecord_grupo', 'is', ticketGroupId]],
                columns: ['internalid']
            }).run().getRange({ start: 0, end: 1000 });

            var boletoIds = boletoSearch.map(function (res) {
                return res.getValue('internalid');
            });
            log.debug('Cantidad de boletos', boletoSearch.length);

            // Eliminar tarjetas asociadas a esos boletos (si hay boletos)
            if (boletoIds.length > 0) {
                var cardSearch = search.create({
                    type: 'customrecord_sdb_card_record',
                    filters: [['custrecord_sdb_parent_ticket', 'anyof', boletoIds]],
                    columns: search.createColumn({ name: 'internalid', summary: search.Summary.GROUP })
                }).run().getRange({ start: 0, end: 1000 });

                cardSearch.forEach(function (res) {
                    if (res) {
                        cardId = res.getValue('internalid')
                        deletedId.push(cardId)
                        record.delete({ type: 'customrecord_sdb_card_record', id: cardId });
                    }
                });
            }

            // Eliminar boletos
            boletoSearch.forEach(function (ticket) {
                if (ticket) {
                    var ticketId = ticket.getValue('internalid')
                    deletedId.push(ticketId)
                    record.delete({ type: 'customrecord_boleto', id: ticketId });
                }
            });

            //Eliminar rutas
            var rutaSearch = search.create({
                type: 'customrecord_ruta',
                filters: [['custrecord_grupoboletosruta', 'is', ticketGroupId]],
                columns: ['internalid']
            }).run().getRange({ start: 0, end: 1000 });

            log.debug('Cantidad de rutas', rutaSearch.length);

            rutaSearch.forEach(function (route) {
                if (route) {
                    var routeId = route.getValue('internalid')
                    deletedId.push(routeId)
                    record.delete({ type: 'customrecord_ruta', id: routeId });
                }
            });

            //Eliminar Factura de compra
            var vendorBillSearch = search.create({
                type: search.Type.VENDOR_BILL,
                filters: [['custbody_sdb_ticket_group', 'is', ticketGroupId], 'and', ['mainline', 'is', 'T']],
                columns: ['internalid']
            }).run().getRange({ start: 0, end: 1000 });

            log.debug('Cantidad de Vendor Bills encontradas', vendorBillSearch.length);

            vendorBillSearch.forEach(function (vbRes) {
                if (vbRes) {
                    var vbID = vbRes.getValue('internalid')
                    deletedId.push(vbID)
                    record.delete({ type: search.Type.VENDOR_BILL, id: vbID });
                }
            });

            // Eliminar grupo de boletos
            record.delete({ type: 'customrecord_grupoboletos', id: ticketGroupId });

            log.debug('Se eliminaron los registros');
            deletedId.forEach(function (id, index) {
                log.debug('Registro eliminado ' + index, 'ID: ' + id);
            });
        }

        return {
            onRequest: onRequest
        };
    });