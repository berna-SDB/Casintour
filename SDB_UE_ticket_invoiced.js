/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function afterSubmit(context) {
        try {
            log.debug('AFTERSUBMIT Triggered', {
                contextType: context.type,
                recordType: context.newRecord.type,
                recordId: context.newRecord.id || 'sin ID'
              });

            if (context.type !== context.UserEventType.CREATE) return;

            var invoice = context.newRecord;
            var invoiceId = invoice.id;
            var lineCount = invoice.getLineCount({ sublistId: 'item' });

            var invoicedTickets = [];

            for (var i = 0; i < lineCount; i++) {
                var boletoNumber = invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_sdb_ticket_number',
                    line: i
                });

                if (!boletoNumber || invoicedTickets.includes(boletoNumber)) continue;

                invoicedTickets.push(boletoNumber);

                // Buscar el boleto en base al número
                var boletoSearch = search.create({
                    type: 'customrecord_boleto',
                    filters: [['custrecord_numeroboleto', 'is', boletoNumber]],
                    columns: ['internalid']
                }).run().getRange({ start: 0, end: 1 });

                if (!boletoSearch.length) {
                    log.error('Boleto no hallado', 'Número: ' + boletoNumber);
                    continue;
                }

                var boletoId = boletoSearch[0].getValue({ name: 'internalid' });

                try {
                    record.submitFields({
                        type: 'customrecord_boleto',
                        id: boletoId,
                        values: {
                            'custrecord_sdb_ticket_processed': true,
                            'custrecord_sdb_ticket_invoice': invoiceId
                        },
                        options: {
                            enablesourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });
                    log.debug('Boleto actualizado desde factura', boletoId);
                } catch (e) {
                    log.error({
                        title: 'Error actualizando boleto ' + boletoId,
                        details: e
                    });
                }
            }

        } catch (e) {
            log.error('Error en afterSubmit', e);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
