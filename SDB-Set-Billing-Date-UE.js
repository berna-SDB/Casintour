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
        } else {
          log.debug('Calendario de facturación', 'EL CLIENTE NO TIENE SETEADO EL CALENDARIO DE FACTURACION INGRESADO');
        }
      }
    } catch (err) {
      log.error('err at beforeSubmit', err);
    }
  }

  return { beforeSubmit: beforeSubmit };
});
