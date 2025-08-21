/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function getInputData() {
        const soSearch = search.create({
            type: search.Type.SALES_ORDER,
            filters: [
                ['mainline', 'is', 'T'],
                'AND', ['custbody_sdb_created_from', 'is', 'T'],
                'AND', ['custbody_sdb_manual_billing', 'is', 'F'],
                'AND', ['custbody_sdb_billing_date_transaction', 'on', 'today'],
                'AND', ['status', 'anyof', 'SalesOrd:H'], //cerrada
            ],
            columns: ['internalid', 'entity', 'custbody_sdb_airline_related', 'custbody_sdb_origen']
        });

        const results = soSearch.run().getRange({ start: 0, end: 10 });
        log.debug('Cantidad de SO encontradas', results.length);
        return soSearch;
    }

    function map(context) {
        try {
            const result = JSON.parse(context.value);
            const salesOrderId = result.id;
            const customerId = result.values.entity.value;
            const airlineId = result.values.custbody_sdb_airline_related || '';
            const origin = result.values.custbody_sdb_origen || '';

            const customFilter = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: customerId,
                columns: ['custentity_sdb_airline_filter', 'custentity_sdb_filter_orig', 'custentity_sdb_tickets_qty'] //lo que seleccionó el cliente
            });

            const groupByAirline = customFilter.custentity_sdb_airline_filter === true;
            const groupByOrigin = customFilter.custentity_sdb_filter_orig === true;

            let key = `${customerId}`;          // base de la clave es el cliente (si ningun check activo entonces solo filtra por cliente y hace una unica SO)
            if (groupByAirline) key += `|${airlineId}`; //selecciono agrupar por aerolinea
            if (groupByOrigin) key += `|${origin}`; //selecciono agrupar por origen
            context.write({ key, value: salesOrderId });
        } catch (e) {
            log.error('Error en map ', e.message);
        }
    }

    function reduce(context) {
        const salesOrderIds = context.values;
        const keyParts = context.key.split('|');
        const customerId = parseInt(keyParts[0]);
        let ticketsInSo = 0;

        try {
            const sourceSo = record.load({
                type: record.Type.SALES_ORDER,
                id: parseInt(salesOrderIds[0]),
                isDynamic: false
            });

            // Extraer los campos necesarios
            const salesOrderData = {
                customerId: sourceSo.getValue({ fieldId: 'entity' }),
                subsidiary: sourceSo.getValue({ fieldId: 'subsidiary' }),
                trandate: sourceSo.getValue({ fieldId: 'trandate' }),
                location: sourceSo.getValue({ fieldId: 'location' }),
                department: sourceSo.getValue({ fieldId: 'department' }),
                class: sourceSo.getValue({ fieldId: 'class' }),
                currency: sourceSo.getValue({ fieldId: 'currency' }),
                createdFrom: true,
                aeroline: sourceSo.getValue({ fieldId: 'custbody_sdb_airline_related' }),
                airlineCode: sourceSo.getValue({ fieldId: 'custbody_sdb_airline_code' }),
                orig: sourceSo.getValue({ fieldId: 'custbody_sdb_origen' }),
            };

            log.debug("Cantidad de sales order encontradas y agrupadas para el cliente " + customerId, salesOrderIds.length)

            const customTicketsQty = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: customerId,
                columns: ['custentity_sdb_tickets_qty'] //la cantidad de boletos seleccionados en una misma orden para este cliente
            });

            const ticketsQty = parseInt(customTicketsQty.custentity_sdb_tickets_qty) || 100;
            log.debug('El ticket qty es ' + ticketsQty)
            // Crear nueva SO vacía
            var mainSo = createEmptySO(salesOrderData)
            var comissionSo = createEmptySO(salesOrderData)

            log.debug('El total de ordenes encontradas ' + salesOrderIds.length)

            for (let i = 0; i < salesOrderIds.length; i++) { //Recorro todas las sales orders 
                const so = record.load({
                    type: record.Type.SALES_ORDER,
                    id: salesOrderIds[i],
                    isDynamic: false
                });
                const lineCount = so.getLineCount({ sublistId: 'item' });

                for (let j = 0; j < lineCount; j++) { //recorro todas las lineas de la sale order
                    const itemType = so.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: j });

                    if (itemType == 'Group') { //grupo de boletos 
                        if (ticketsInSo == ticketsQty) {
                            customSummary(mainSo);
                            const soSavedId = mainSo.save();
                            log.debug('SO completa guardada', "https://11341630-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=" + soSavedId + "&whence=");
                            //createInvoice(soSavedId);

                            mainSo = createEmptySO(salesOrderData) //Creo otra sale order
                            ticketsInSo = 0;
                            endGroupIndex = 0;
                        }
                        const groupItemId = so.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });
                        const groupDescription = so.getSublistValue({ sublistId: 'item', fieldId: 'description', line: j });
                        const ticketNumber = so.getSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_ticket_number', line: j });
                        const routes = so.getSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_ticket_route', line: j });


                        mainSo.selectNewLine({ sublistId: 'item' });
                        mainSo.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: groupItemId });
                        mainSo.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: groupDescription });
                        mainSo.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_salesorder_ref', value: salesOrderIds[i] });
                        mainSo.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_ticket_number', value: ticketNumber });
                        mainSo.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_ticket_route', value: routes });
                        mainSo.commitLine({ sublistId: 'item' });
                        ticketsInSo++;
                        endGroupIndex = mainSo.getLineCount({ sublistId: 'item' }) - 1;   // posición del cierre de grupo 
                    }
                    else if (itemType == 'Markup' || itemType == 'NonInvtPart') { //taxes || boleto || comision
                        const item = so.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });
                        const rate = so.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: j });
                        insertItem(mainSo, endGroupIndex, item, rate)

                        endGroupIndex++; //El cierre de grupo se desplazo hacia abajo 
                    }
                    else if (itemType == 'OthCharge') { // comision se factura aparte 
                        const itemId = so.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });
                        const rate = so.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: j });

                        comissionSo.selectNewLine({ sublistId: 'item' });
                        comissionSo.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemId });
                        comissionSo.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
                        comissionSo.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: rate });
                        comissionSo.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_sdb_salesorder_ref', value: salesOrderIds[i] });
                        comissionSo.commitLine({ sublistId: 'item' });
                    }
                }
            }
            deleteItem(mainSo, -3)
            customSummary(mainSo);
            var newSoId = mainSo.save();
            log.debug('Sales Order principal creada', "https://11341630-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=" + newSoId + "&whence=");
            //createInvoice(newSoId);

            if (comissionSo.getLineCount({ sublistId: 'item' }) > 0) {
                customSummary(comissionSo);
                var comissionSoId = comissionSo.save()
                log.debug('Sales Order por comisiones creada', "https://11341630-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=" + comissionSoId + "&whence=");
                //createInvoice(comissionSoId);
            }
        } catch (e) {
            log.error('Error al crear Sales Order principal para cliente ' + customerId, e.message);
        }
    }

    function createEmptySO(salesOrderData) {
        var groupByAirline = false;
        var groupByOrigin = false;

        if (salesOrderData.customerId) {
            const customFilter = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: salesOrderData.customerId,
                columns: ['custentity_sdb_airline_filter', 'custentity_sdb_filter_orig']
            });
            groupByAirline = customFilter.custentity_sdb_airline_filter === true;
            groupByOrigin = customFilter.custentity_sdb_filter_orig === true;
        }
        var mainSo = record.create({
            type: record.Type.SALES_ORDER,
            isDynamic: true
        });

        mainSo.setValue({ fieldId: 'entity', value: parseInt(salesOrderData.customerId) });
        mainSo.setValue({ fieldId: 'orderstatus', value: "B" }); // 2 = Aprobado
        if (salesOrderData.subsidiary)
            mainSo.setValue({ fieldId: 'subsidiary', value: salesOrderData.subsidiary });

        if (salesOrderData.trandate)
            mainSo.setValue({ fieldId: 'trandate', value: salesOrderData.trandate });

        if (salesOrderData.location)
            mainSo.setValue({ fieldId: 'location', value: salesOrderData.location });

        if (salesOrderData.department)
            mainSo.setValue({ fieldId: 'department', value: salesOrderData.department });

        if (salesOrderData.class)
            mainSo.setValue({ fieldId: 'class', value: salesOrderData.class });

        if (salesOrderData.currency)
            mainSo.setValue({ fieldId: 'currency', value: salesOrderData.currency });

        if (salesOrderData.billingDate)
            mainSo.setValue({ fieldId: 'custbody_sdb_billing_date_transaction', value: salesOrderData.billingDate });

        if (salesOrderData.createdFrom)
            mainSo.setValue({ fieldId: 'custbody_sdb_created_from', value: true });

        if (groupByAirline && salesOrderData.aeroline)
            mainSo.setValue({ fieldId: 'custbody_sdb_airline_related', value: salesOrderData.aeroline });

        if (groupByOrigin && salesOrderData.orig)
            mainSo.setValue({ fieldId: 'custbody_sdb_origen', value: salesOrderData.orig });

        if (salesOrderData.airlineCode)
            mainSo.setValue({ fieldId: 'custbody_sdb_airline_code', value: salesOrderData.airlineCode });

        return mainSo;
    }

    function insertItem(order, line, itemId, rate) {
        order.insertLine({ sublistId: 'item', line: line });
        order.selectLine({ sublistId: 'item', line: line });
        order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: itemId });
        order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
        order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: rate });
        order.commitLine({ sublistId: 'item' });
    }

    function createInvoice(salesOrderId) {
        try {
            var invoice = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: salesOrderId,
                toType: record.Type.INVOICE,
                isDynamic: true
            });

            var invoiceId = invoice.save();

            log.debug('Factura de venta creada', invoiceId);
            return invoiceId;

        } catch (error) {
            throw new Error('Error en createInvoice: ' + error);
        }

    }

    function customSummary(transaction) {
        let totalImpuestos = 0;
        const lineCount = transaction.getLineCount({ sublistId: 'item' });
        let taxec = 0;
        let taxed = 0;
        let taxOtro = 0;
        let taxcombustible = 0;
        let taxcombustibleIva = 0;
        let totalCommissionD = 0;
        let totalCommissionI = 0;
        let totalBoletosIva = 0;
        let totalboletosSiva = 0;

        for (let i = 0; i < lineCount; i++) {
            let itemId = parseInt(transaction.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            }));

            if (itemId === 276 || itemId === 277 || itemId === 278 || itemId === 279 || itemId === 280 || itemId === 282 || itemId === 283) { //sumo los montos de taxec, taxotro, taxed, combustibleCiva, combustibleSiva, comisionD, comisionI
                let grossamt = parseFloat(transaction.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'grossamt',
                    line: i
                })) || 0;

                totalImpuestos += grossamt;
            }

            switch (itemId) {
                case 277:      // taxec
                    let taxecAmt = parseFloat(transaction.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'grossamt',
                        line: i
                    })) || 0;

                    taxec += taxecAmt;
                    break;
                case 278:      // taxotro
                    let taxOtroAmt = parseFloat(transaction.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'grossamt',
                        line: i
                    })) || 0;

                    taxOtro += taxOtroAmt;
                    break;
                case 276:      // taxed
                    const taxedAmt = parseFloat(
                        transaction.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'grossamt',
                            line: i
                        })
                    ) || 0;

                    taxed += taxedAmt;
                    break;

                case 279:      // combustible c/iva
                    const taxCombustibleciva = parseFloat(
                        transaction.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'grossamt',
                            line: i
                        })
                    ) || 0;

                    taxcombustibleIva += taxCombustibleciva;
                    break;

                case 280:      // combustible s/iva
                    const taxCombustiblesiva = parseFloat(
                        transaction.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'grossamt',
                            line: i
                        })
                    ) || 0;

                    taxcombustible += taxCombustiblesiva;
                    break;

                case 282:      // comision nacional
                    const totalComisionNacional = parseFloat(
                        transaction.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'grossamt',
                            line: i
                        })
                    ) || 0;

                    totalCommissionD += totalComisionNacional;
                    break;

                case 283:      // comision internacional
                    const totalComisionInternacional = parseFloat(
                        transaction.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'grossamt',
                            line: i
                        })
                    ) || 0;

                    totalCommissionI += totalComisionInternacional;
                    break;

                case 263:      // boleto sin iva
                    const totalBoletoSinIva = parseFloat(
                        transaction.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'grossamt',
                            line: i
                        })
                    ) || 0;

                    totalboletosSiva += totalBoletoSinIva;
                    break;

                case 281:      // boleto con iva 
                    const totalBoletoConIva = parseFloat(
                        transaction.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'grossamt',
                            line: i
                        })
                    ) || 0;

                    totalBoletosIva += totalBoletoConIva;
                    break;
                default:
                    break;
            }
        }

        // total de impuestos en resumen custom
        transaction.setValue({
            fieldId: 'custbody_sdb_tax_total',
            value: totalImpuestos.toFixed(2)
        });
        transaction.setValue({
            fieldId: 'custbody_sdb_taxec_total',
            value: taxec.toFixed(2)
        });
        transaction.setValue({
            fieldId: 'custbody_sdb_total_taxed',
            value: taxed.toFixed(2)
        });
        transaction.setValue({
            fieldId: 'custbody_sdb_taxotro_total',
            value: taxOtro.toFixed(2)
        });
        transaction.setValue({
            fieldId: 'custbody_sdb_total_taxcombustible',
            value: taxcombustible.toFixed(2)
        });
        transaction.setValue({
            fieldId: 'custbody_sdb_total_taxcombustibleciva',
            value: taxcombustibleIva.toFixed(2)
        });
        transaction.setValue({
            fieldId: 'custbody_sdb_total_commission_nac',
            value: totalCommissionD.toFixed(2)
        });
        transaction.setValue({
            fieldId: 'custbody_sdb_total_commission_inter',
            value: totalCommissionI.toFixed(2)
        });
        transaction.setValue({
            fieldId: 'custbody_sdb_total_boletos',
            value: totalboletosSiva.toFixed(2)
        });
        transaction.setValue({
            fieldId: 'custbody_sdb_total_boletosiva',
            value: totalBoletosIva.toFixed(2)
        });
    }

    function deleteItem(order, itemDeleteId) {
        const lineCount = order.getLineCount({ sublistId: 'item' });
        for (let i = lineCount - 1; i >= 0; i--) {
            const itemId = parseInt(order.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            }));
            if (itemId === itemDeleteId) {
                order.removeLine({
                    sublistId: 'item',
                    line: i
                });
            }
        }
    }

    return {
        getInputData,
        map,
        reduce
    };
});
