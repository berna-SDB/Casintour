/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define([
  "N/currentRecord",
  "N/record",
  "N/search",
  "N/format",
  "./SDB-LIB-Billing-Calendar.js",
  "N/log"
], function (currentRecord, record, search, format, LIB, log) {

  function beforeSubmit(ctx) {
    try {
      let currentRcd = ctx.newRecord;
      let date = currentRcd.getValue("trandate");
      let customerID = currentRcd.getValue("entity");

      // Verificar si existe alguna línea ABIERTA (si hay linea abierta entonces no debemos setear fecha de facturacion)
      let lineCount = currentRcd.getLineCount({ sublistId: "item" });
      let hasOpenLine = false;

      for (let i = 0; i < lineCount; i++) {
        let isClosed = currentRcd.getSublistValue({
          sublistId: "item",
          fieldId: "isclosed",
          line: i
        });

        if (!isClosed) {
          hasOpenLine = true;
          break; // ya se encontro linea de articulo abierta, no es necesario seguir
        }
      }

      // 🔹 Si hay al menos una línea abierta → no setear fecha
      if (hasOpenLine) {
        log.debug("beforeSubmit", "Se encontró una línea abierta, no se setea fecha de facturación");
        return;
      }

      if (date) {
        let billingCalendar =
          search.lookupFields({
            type: "customer",
            id: customerID,
            columns: "custentity_sdb_billing_calendar",
          }).custentity_sdb_billing_calendar?.[0].value || false;

        if (billingCalendar) {
          let billingCalendarObj = LIB.searchBillingCalendar(billingCalendar);
          let billingDate;

          if (billingCalendarObj.unic_event) {
            billingDate = LIB.unicEventSetDate(billingCalendarObj);
          } else if (billingCalendarObj.daily_event) {
            billingDate = LIB.dailyEventSetDate(billingCalendarObj, date);
          } else if (billingCalendarObj.event_weekly) {
            billingDate = LIB.weeklyEventSetDate(billingCalendarObj, date);
          } else if (billingCalendarObj.monthly_event) {
            billingDate = LIB.monthlyEventSetDate(billingCalendarObj, date);
          } else if (billingCalendarObj.biweekly_event) {
            billingDate = LIB.biweeklyEventSetDate(billingCalendarObj, date);
          }
          log.debug('Date seleccionada en la orden ', date)
          log.debug('Billingdate formatted typeof/valor ', typeof LIB.getDateFormatted(billingDate) + " / " + billingDate);

          currentRcd.setValue({
            fieldId: 'custbody_sdb_billing_date_transaction',
            value: LIB.getDateFormatted(billingDate)
          });
        }
      } else {
        log.debug('Calendario de facturación', 'EL CLIENTE NO TIENE SETEADO EL CALENDARIO DE FACTURACION INGRESADO');
      }
    } catch (err) {
      log.error('err at afterSubmit', err);
    }
  }

  return { beforeSubmit: beforeSubmit };
});
