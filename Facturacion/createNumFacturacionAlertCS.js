/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/ui/dialog'], (dialog) => {
  function saveRecord(ctx) {
    const rec = ctx.currentRecord;

    const estab = (rec.getValue('custbody_sdb_n_serie_compr_estab') || '').toString().replace(/\D/g, '');
    const pto = (rec.getValue('custbody_sdb_n_serie_compr_pto_estab') || '').toString().replace(/\D/g, '');
    const sec = (rec.getValue('custbody_sdb_n_sec_compr_compra') || '').toString().replace(/\D/g, '');

    const errs = [];
    if (estab && estab.length > 3) errs.push('• Establecimiento debe tener máximo 3 dígitos.');
    if (pto && pto.length > 3) errs.push('• Punto de emisión debe tener máximo 3 dígitos.');
    if (sec && sec.length > 9) errs.push('• Secuencial debe tener máximo 9 dígitos.');

    if (errs.length) {
      dialog.alert({
        title: 'Número de comprobante incompleto',
        message: 'Revisá los valores del número de comprobante:\r\n\r\n' + errs.join('\r\n')
      });
      return false;
    }
    return true;
  }
  return { saveRecord };
});
