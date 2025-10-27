/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

define([
    'N/log', './SDBProcesarTerrestreLib'],// ruta del File Cabinet
    (log, TerrestreLib) => {

        /**
         * POST principal, recibe el JSON y lo pasa a la librería
         */
        function post(requestBody) {
            try {
                const result = TerrestreLib.processRequest(requestBody);
                return result;
            } catch (e) {
                log.error('Error en Restlet.post', e);
                return {
                    success: false,
                    message: e.message || 'Error en Restlet.post'
                };
            }
        }

        return {
            post: post,
        };
    });
