/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([], () => {
    function beforeLoad(ctx) {
        if (ctx.type !== ctx.UserEventType.VIEW) return;

        // Apunta al Client Script que manejará el click
        ctx.form.clientScriptModulePath = 'SuiteScripts/buttonRecoveryBoletoCS';

        // Agregar botón
        ctx.form.addButton({
            id: 'custpage_btn_generar',
            label: 'Generar transacciones',
            functionName: 'onButtonClick' // esta función debe ser del Client Script
        });
    }
    return { beforeLoad };
});