/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/error'], function (log, error) {

    function beforeSubmit(context) {
        if (context.type === context.UserEventType.DELETE) return;
        log.debug('Ejecutando sdb_create_num_facturacion')

        var rec = context.newRecord;

        var estab = rec.getValue({ fieldId: 'custbody_sdb_n_serie_compr_estab' });
        var puntoEmision = rec.getValue({ fieldId: 'custbody_sdb_n_serie_compr_pto_estab' });
        var secuencial = rec.getValue({ fieldId: 'custbody_sdb_n_sec_compr_compra' });

        // Si falta alguno, no tocamos el Reference No.
        if (!estab || puntoEmision == null || secuencial == null) return;

        var ref = pad(estab, 3) + '-' + pad(puntoEmision, 3) + '-' + pad(secuencial, 9);

        rec.setValue({ fieldId: 'tranid', value: ref });// 'tranid' es el campo Reference No.
        rec.setValue({ fieldId: 'custbody_sdb_n_serie_compr_estab', value: pad(estab, 3) });
        rec.setValue({ fieldId: 'custbody_sdb_n_serie_compr_pto_estab', value: pad(puntoEmision, 3) });
        rec.setValue({ fieldId: 'custbody_sdb_n_sec_compr_compra', value: pad(secuencial, 9) });

    }

    function pad(num, size) {
        var s = String(num == null ? "" : num).replace(/\D/g, ""); // solo dígitos
        while (s.length < size) s = "0" + s;
        return s;
    }

    return { beforeSubmit: beforeSubmit };
});