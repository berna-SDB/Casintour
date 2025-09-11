/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/url', 'N/ui/dialog'], (currentRecord, url, dialog) => {
    function pageInit(context) {
    }

    const onButtonClick = async () => {
        const rec = currentRecord.get();
        const recId = rec.id; //utiliza el ID del registro actual
        if (!recId) {
            await dialog.alert({ title: 'Falta ID', message: 'No se pudo obtener el ID del registro.' });
            return;
        }

        const confirm = await dialog.confirm({ title: 'Confirmar', message: '¿Borrar y reprocesar?' });
        if (!confirm) return;

        const slUrl = url.resolveScript({
            scriptId: 'customscript_sdb_recovery_ticket_slet',
            deploymentId: 'customdeploy_sdb_recovery_ticket_slet'
        });

        const resp = await fetch(slUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recId })  // solo envia el ID
        });

        const text = await resp.text();
        await dialog.alert({ title: 'Resultado', message: text });
    };

    return { pageInit, onButtonClick };
});
