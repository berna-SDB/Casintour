/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define([
  "N/log"
], function (log) {
  //Script que se ejecuta para actualizar el resumen custom cuando se edita la orden de venta.
  function beforeSubmit(ctx) {

    try {
      let currentRcd = ctx.newRecord;
      log.debug('Ejecutando custom summary en ' + ctx.newRecord.type + ' Id del registro ' + ctx.newRecord.id)
      customSummary(currentRcd);


    } catch (err) {
      log.error("Error en beforeSubmit", err);
    }
  }

  function customSummary(transaction) {
    let totalImpuestos = 0;
    const lineCount = transaction.getLineCount({ sublistId: 'item' });
    let taxec = 0, taxed = 0, taxOtro = 0, taxcombustible = 0, taxcombustibleIva = 0;
    let totalCommissionD = 0, totalCommissionI = 0;
    let totalBoletosIva = 0, totalboletosSiva = 0, totalBoletos = 0;

    for (let i = 0; i < lineCount; i++) {
      let itemId = parseInt(transaction.getSublistValue({
        sublistId: 'item',
        fieldId: 'item',
        line: i
      }));

      if (itemId === 276 || itemId === 277 || itemId === 278 || itemId === 279 || itemId === 280 || itemId === 282 || itemId === 283) { //suma los montos de taxec, taxotro, taxed, combustibleCiva, combustibleSiva, comisionD, comisionI
        let grossamt = parseFloat(transaction.getSublistValue({
          sublistId: 'item',
          fieldId: 'grossamt',
          line: i
        })) || 0;

        totalImpuestos += grossamt;
      }
      switch (itemId) {
        case 277: taxec += getGross(transaction, i); break;
        case 278: taxOtro += getGross(transaction, i); break;
        case 276: taxed += getGross(transaction, i); break;
        case 279: taxcombustibleIva += getGross(transaction, i); break;
        case 280: taxcombustible += getGross(transaction, i); break;
        case 282: totalCommissionD += getGross(transaction, i); break;
        case 283: totalCommissionI += getGross(transaction, i); break;
        case 263: totalBoletos++; totalboletosSiva += getGross(transaction, i); break;
        case 281: totalBoletos++; totalBoletosIva += getGross(transaction, i); break;
        default: break;
      }
    }

    // Seteo de campos resumen
    transaction.setValue({ fieldId: 'custbody_sdb_tax_total', value: totalImpuestos.toFixed(2) });
    transaction.setValue({ fieldId: 'custbody_sdb_taxec_total', value: taxec.toFixed(2) });
    transaction.setValue({ fieldId: 'custbody_sdb_total_taxed', value: taxed.toFixed(2) });
    transaction.setValue({ fieldId: 'custbody_sdb_taxotro_total', value: taxOtro.toFixed(2) });
    transaction.setValue({ fieldId: 'custbody_sdb_total_taxcombustible', value: taxcombustible.toFixed(2) });
    transaction.setValue({ fieldId: 'custbody_sdb_total_taxcombustibleciva', value: taxcombustibleIva.toFixed(2) });
    transaction.setValue({ fieldId: 'custbody_sdb_total_commission_nac', value: totalCommissionD.toFixed(2) });
    transaction.setValue({ fieldId: 'custbody_sdb_total_commission_inter', value: totalCommissionI.toFixed(2) });
    transaction.setValue({ fieldId: 'custbody_sdb_total_boletos', value: totalboletosSiva.toFixed(2) });
    transaction.setValue({ fieldId: 'custbody_sdb_total_boletosiva', value: totalBoletosIva.toFixed(2) });
    transaction.setValue({ fieldId: 'custbody_sdb_tickets_quantity', value: totalBoletos });

    var total = (totalImpuestos + totalboletosSiva + totalBoletosIva).toFixed(2)
    log.debug('CustomSummary ejecutado ')
    log.debug('El monto total es ', total)
  }

  function getGross(transaction, line) {
    return parseFloat(transaction.getSublistValue({
      sublistId: 'item',
      fieldId: 'grossamt',
      line
    })) || 0;
  }

  return { beforeSubmit };
});
