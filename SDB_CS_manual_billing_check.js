/**
 * @NApiVersion 2.1          
 * @NScriptType ClientScript
 */
define([], function () {

  function fieldChanged(context) {

    // Entra solo cuando cambia el checkbox
    if (context.fieldId !== 'custbody_sdb_manual_billing') {
      return;
    }

    var rec = context.currentRecord;
    var checked = rec.getValue({ fieldId: 'custbody_sdb_manual_billing' });
    var lineCount = rec.getLineCount({ sublistId: 'item' });

    for (var i = 0; i < lineCount; i++) {

      var itemType = rec.getSublistValue({
        sublistId: 'item',
        fieldId: 'itemtype',
        line: i
      });
      if (itemType === 'EndGroup') continue;

      rec.selectLine({ sublistId: 'item', line: i });

      if (checked == true) {//la facturacion es manual, abrir orden
        rec.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'isclosed',
          value: false
        });

        rec.commitLine({ sublistId: 'item' });
      }
      else {
        rec.setCurrentSublistValue({//la facturacion es automatica, cerrar orden
          sublistId: 'item',
          fieldId: 'isclosed',
          value: true
        });
        rec.commitLine({ sublistId: 'item' });
      }
    }
  }

  return {
    fieldChanged: fieldChanged
  };
});
