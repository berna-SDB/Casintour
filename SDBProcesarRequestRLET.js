/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

define([
    'N/log', './SDBCreacionDeBoletoLib'],// ruta del File Cabinet
    (log, BoletoLib) => {

        /**
         * POST principal, recibe el JSON y lo pasa a la librería
         */
        function post(requestBody) {
            try {
                const result = BoletoLib.processRequest(requestBody);
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
