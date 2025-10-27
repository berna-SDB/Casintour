/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/runtime', 'N/search'], function (record, runtime, search) {

    function afterSubmit(ctx) {
        if (ctx.type !== ctx.UserEventType.CREATE) return;
        try {
            var newRec = ctx.newRecord;
            log.debug('Trasladando campos de FE a orden de compra')
            propagateFEFieldsToVendorBillFromInvoice(newRec.id);
        } catch (error) {
            log.error('afterSubmit', error);
        }
    }

    function propagateFEFieldsToVendorBillFromInvoice(invoiceId) {
        var inv = record.load({ type: record.Type.INVOICE, id: invoiceId });
        // Campos FE en la factura de venta (origen)
        var ptoComp = inv.getValue('custbody_sdb_ec_sat_punto_comprobante');
        var nAuth = inv.getValue('custbody_sdb_ec_sat_n_auth');
        var numComp = inv.getValue('custbody_sdb_ec_sat_num_comprobante');
        var groupId = inv.getValue('custbody_sdb_ticket_group');
        var tranId = buildTranId(nAuth, ptoComp, numComp);

        if (!groupId) return;

        // Buscar la Vendor Bill intercompany del mismo grupo
        var vb = search.create({
            type: search.Type.VENDOR_BILL,
            filters: [
                ['custbody_sdb_ticket_group', 'anyof', groupId], 'AND',
                ['mainline', 'is', 'T']
            ],
            columns: ['internalid']
        }).run().getRange({ start: 0, end: 1 });

        if (!vb || !vb.length) {
            log.debug('No se encontró la factura de compra para el grupo de boletos ' + groupId)
            return;
        }

        var vbId = vb[0].getValue('internalid');

        record.submitFields({
            type: record.Type.VENDOR_BILL,
            id: vbId,
            values: {
                custbody_sdb_n_sec_compr_compra: numComp || null,
                custbody_sdb_n_serie_compr_pto_estab: ptoComp || null,
                custbody_sdb_n_serie_compr_estab: nAuth || null,
                custbody_sdb_num_comp_full: tranId || null
            }
        });
    }

    function buildTranId(est, pto, sec) {
        return (est || '') + ' - ' + (pto || '') + ' - ' + (sec || '');
    }
    return { afterSubmit: afterSubmit };
});
