/**
 * @NApiVersion 2.1
 */
define(["N/currentRecord", "N/format", "N/record", "N/search", "N/log"], /**
 * @param{currentRecord} currentRecord
 * @param{format} format
 * @param{record} record
 * @param{search} search
 */
  (currentRecord, format, record, search, log) => {
    // ------ EVENTO UNICO -------
    function unicEventSetDate(objRecord) {
      try {
        if (!objRecord.unic_event) {
          return;
        }
        const parts = objRecord.date_unic.split("/");

        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);

        const newDate = year + "/" + month + "/" + day;
        return newDate;
      } catch (error) {
        log.error("err at unicEventSetDate", error);
      }
    }

    // ------ EVENTO DIARIO -------
    function dailyEventSetDate(objRecord, dateObj) {
      try {
        if (!objRecord.daily_event) {
          return;
        }

        if (objRecord.daily_repeat) {
          dateObj.setDate(dateObj.getDate() + 1);
        }

        if (objRecord.daily_bussines_day) {
          dateObj = addBusinessDay(dateObj);
        }

        // Devuelve la fecha Date
        return dateObj;
      } catch (error) {
        log.error("Error at dailyEventSetDate", error);
      }
    }

    // ------ EVENTO SEMANAL -------

    function weeklyEventSetDate(objRecord, dateObj) {
      try {
        if (!objRecord.event_weekly) {
          return;
        }

        let objDays = {
          Domingo: 0,
          Lunes: 1,
          Martes: 2,
          Miércoles: 3,
          Jueves: 4,
          Viernes: 5,
          Sábado: 6,
        };
        let dayRule = objRecord.weekly_day;
        let targetDay = objDays[dayRule];

        let tranDateObj = new Date(dateObj);
        let currentDay = tranDateObj.getDay();

        let nextDate = new Date(dateObj);

        if (currentDay !== targetDay) {
          let daysToAdd = (targetDay - currentDay + 7) % 7;
          nextDate.setDate(dateObj.getDate() + daysToAdd);
        }

        log.debug(`Fecha final para ${dayRule}:`, nextDate);
        return nextDate;
      } catch (error) {
        log.error("Error at weeklyEventSetDate", error);
      }
    }

    // -------- EVENTO MENSUAL -------
    function monthlyEventSetDate(objRecord, dateObj) {
      try {
        if (!objRecord.monthly_event) {
          return;
        }

        // Si es un dia Particular de un mes ej: todos los 20
        if (objRecord.monthly_every_day) {
          let dayOfMonth = parseInt(objRecord.monthly_every_day, 10);
          let today = new Date(dateObj);
          let year = today.getFullYear();
          let month = today.getMonth();

          // Si ya pasamos el día de este mes, sumamos uno al mes
          if (today.getDate() > dayOfMonth) {
            month += 1;
          }

          let resultDate = new Date(year, month, dayOfMonth);

          log.debug(`Próxima ejecución para día ${dayOfMonth}:`, resultDate);

          return resultDate;
        }

        if (objRecord.monthly_numeration && objRecord.monthly_day_billing) {
          const objDays = {
            Domingo: 0,
            Lunes: 1,
            Martes: 2,
            Miércoles: 3,
            Jueves: 4,
            Viernes: 5,
            Sábado: 6,
          };
          const orderDays = {
            Primer: 0,
            Segundo: 1,
            Tercer: 2,
            Cuarto: 3,
            Ultimo: -1,
          };

          const targetDay = objDays[objRecord.monthly_day_billing];
          const order = orderDays[objRecord.monthly_numeration];

          let today = new Date(dateObj);
          let year = today.getFullYear();
          let month = today.getMonth();

          // Intentamos para este mes
          let resultDate = getMonthlyWeekdayDate(year, month, targetDay, order);

          // Si ya pasó, buscamos en el mes siguiente
          if (resultDate < today.setHours(0, 0, 0, 0)) {
            resultDate = getMonthlyWeekdayDate(year, month + 1, targetDay, order);
          }

          return resultDate;
        }

        if (objRecord.last_day_month) {
          let today = new Date(dateObj);
          let year = today.getFullYear();
          let month = today.getMonth();

          // Obtenemos el último día del mes actual
          let lastDayCurrentMonth = new Date(year, month + 1, 0);

          // Si ya pasó, vamos al mes siguiente
          if (today > lastDayCurrentMonth) {
            lastDayCurrentMonth = new Date(year, month + 2, 0);
          }

          return lastDayCurrentMonth;
        }
      } catch (error) {
        log.debug("Error at monthlyEventSetDate", error);
      }
    }
    function getMonthlyWeekdayDate(year, month, weekday, order) {
      const date = new Date(year, month, 1);
      const dates = [];

      while (date.getMonth() === month) {
        if (date.getDay() === weekday) {
          dates.push(new Date(date));
        }
        date.setDate(date.getDate() + 1);
      }

      if (order === -1) {
        return dates[dates.length - 1]; // Último
      }

      return dates[order] || null;
    }

    // -------- EVENTO QUINCENAL -------
    //La fecha de fact es menor a la seteada en la primer quincena  ----- setea primer quincena
    //La fecha de fact es mayor a la seteada en la segunda quincena  ----- setea primer quincena
    //La fecha de fact es mayor a la seteada en la primer quincena y menor a la seteada en la segunda ----- setea segunda quincena 
    function biweeklyEventSetDate(objRecord, dateObj) {
      try {
        let today = new Date(dateObj);
        let year = today.getFullYear();
        let month = today.getMonth();

        const objDays = {
          Domingo: 0,
          Lunes: 1,
          Martes: 2,
          Miércoles: 3,
          Jueves: 4,
          Viernes: 5,
          Sábado: 6,
        };
        const orderDays = {
          Primer: 0,
          Segundo: 1,
          Tercer: 2,
          Cuarto: 3,
          Ultimo: -1,
        };

        let firstWeekday = objDays[objRecord.first_biweekly_billing]; //Nombre de dia seteado en quincena 
        let secondWeekday = objDays[objRecord.second_biweekly_billing];

        let firstOrder = orderDays[objRecord.first_biweekly_numeration];
        let secondOrder = orderDays[objRecord.second_biweek_numeration];

        let firstResultDate = getBiweeklyWeekdayDate(year, month, firstWeekday, firstOrder, 'first');
        let secondResultDate = getBiweeklyWeekdayDate(year, month, secondWeekday, secondOrder, 'second');

        let dayOfFirstBiweekly = parseInt(objRecord.first_biweekly_day, 10); //numero de dia seteado en la quincena 
        let dayOfSecondBiweekly = parseInt(objRecord.second_biweekly_day, 10);

        let firstLastDayCurrentBiweek = new Date(year, month, 15); //Calcula fin de quincena 
        let secondLastDayCurrentBiweek = new Date(year, month + 1, 0);

        if (
          (
            (dayOfFirstBiweekly && today.getDate() > dayOfFirstBiweekly) ||
            (objRecord.last_day_first_biweek && today >= firstLastDayCurrentBiweek) ||
            (firstResultDate && today > firstResultDate)
          ) &&
          (
            (dayOfSecondBiweekly && today.getDate() < dayOfSecondBiweekly) ||
            (objRecord.last_day_sd_second_biweek && today < secondLastDayCurrentBiweek) ||
            (secondResultDate && today < secondResultDate)
          )
        ) {//la fecha de fact es mayor a la seteada en la primer quincena y menor a la seteada en la segunda ----- seteo segunda quincena 
          log.debug('Entro en Seteo de segunda quincena')
          if (objRecord.second_biweekly_day) {// Si es un dia Particular de la segunda quincena
            let dayOfSecondBiweekly = parseInt(objRecord.second_biweekly_day, 10);
            let resultDate = new Date(year, month, dayOfSecondBiweekly);
            return resultDate;

          } else if (objRecord.second_biweek_numeration && objRecord.second_biweekly_billing) {//Si son días especificos "Primer, segundo, ultimo"
            log.debug('Entro en Seteo de objRecord.second_biweek_numeration && objRecord.second_biweekly_billing')
            let resultDate = secondResultDate

            // Si ya pasó, buscamos en el mes siguiente
            if (resultDate < today.setHours(0, 0, 0, 0)) {
              resultDate = getMonthlyWeekdayDate(year, month + 1, secondWeekday, secondOrder);
            }
            return resultDate;

          } else if (objRecord.last_day_sd_second_biweek) {//Si se selecciono el ultimo dia de la segunda quincena.
            log.debug('Entro en Seteo de objRecord.last_day_sd_second_biweek')
            return secondLastDayCurrentBiweek;
          }
        }

        else { //si no cumple con la condicion anterior entonces siempre va a ser primer quincena 
          log.debug('Entro en Seteo de primera quincena')

          if (objRecord.first_biweekly_day) { // Si es un dia Particular de la primera quincena
            log.debug('Entro en Seteo de first_biweekly_day')
            let resultDate = new Date(year, month, dayOfFirstBiweekly);

            if (resultDate < today.setHours(0, 0, 0, 0)) {
              resultDate = new Date(year, month + 1, dayOfFirstBiweekly);
            }
            return resultDate;

          } else if (objRecord.first_biweekly_numeration && objRecord.first_biweekly_billing) { //Si se selecciono día especifico "Primer, segundo, ultimo"
            log.debug('Entro en Seteo de objRecord.first_biweekly_numeration && objRecord.first_biweekly_billing')
            let resultDate = firstResultDate

            // Si ya pasó, buscamos en el mes siguiente
            if (resultDate < today.setHours(0, 0, 0, 0)) {
              resultDate = getMonthlyWeekdayDate(year, month + 1, firstWeekday, firstOrder);
            }
            return resultDate;

          } else if (objRecord.last_day_first_biweek) { //Si selecciono el ultimo dia de la primer quincena.
            log.debug('Entro en Seteo de objRecord.last_day_first_biweek')
            return firstLastDayCurrentBiweek;
          }
        }
      }
      catch (error) {
        log.debug("Error at biweeklyEventSetDate", error);
      }
    }

    //Devuelve primer lunes, segundo lunes, etc de la primer o segunda quincena dependiendo el parametro part
    function getBiweeklyWeekdayDate(year, month, weekday, order, part) {
      // límites de la quincena
      const startDay = (part === 'second') ? 16 : 1;
      const endDay = (part === 'second')
        ? new Date(year, month + 1, 0).getDate() // último día del mes
        : 15;

      const matches = [];
      // comienza en el primer día de la quincena
      const d = new Date(year, month, startDay);
      d.setHours(0, 0, 0, 0);

      // recorre hasta el final de la quincena (inclusive)
      while (d.getMonth() === month && d.getDate() <= endDay) {
        if (d.getDay() === weekday) {
          matches.push(new Date(d)); // guardamos copia
        }
        d.setDate(d.getDate() + 1);
      }

      if (matches.length === 0) return null;

      if (order === -1) {
        return matches[matches.length - 1]; // Último weekday dentro de la quincena
      }
      return matches[order] || null; // Primer/Segundo
    }

    function getDateFormatted(date) {
      try {
        // log.debug("formattedDateString-1", date);
        var newDate = new Date(date);
        //log.debug("formattedDateString-2", newDate);
        var formattedDateString = format.parse({
          value: newDate,
          type: format.Type.DATE,
        });
        //log.debug("formattedDateString", formattedDateString);
        return formattedDateString;
      } catch (error) {
        log.error("getDateFormatted error:", error);
      }
    }

    function searchBillingCalendar(idReference) {
      var customrecord_sdb_billing_calendarSearchObj = search.create({
        type: "customrecord_sdb_billing_calendar",
        filters: [["internalid", "anyof", idReference]],
        columns: [
          search.createColumn({
            name: "custrecord_sdb_unic_event_",
            label: "Evento Unico ",
          }),
          search.createColumn({
            name: "custrecord_sdb_unic_date",
            label: "Fecha Unica ",
          }),
          search.createColumn({
            name: "custrecord_sdb_daily_event_check",
            label: "Evento Diario",
          }),
          search.createColumn({
            name: "custrecord_sdb_daily_event_repeat",
            label: "Repetir Cada dia",
          }),
          search.createColumn({
            name: "custrecord_sdb_daily_repeat_bussines_day",
            label: "Repetir Cada dia Habil",
          }),
          search.createColumn({
            name: "custrecord_sdb_weekly_day",
            label: "Dias de la Semana",
          }),
          search.createColumn({
            name: "custrecord_sdb_monthly_event",
            label: "Evento Mensual",
          }),
          search.createColumn({
            name: "custrecord_monthly_day_billing",
            label: "Dia de Cada",
          }),
          search.createColumn({
            name: "custrecord_sdb_date_create_transact",
            label: "Fecha de Creacion",
          }),
          search.createColumn({
            name: "custrecord_sdb_monthly_numeration",
            label: "El ",
          }),
          search.createColumn({
            name: "custrecord_sdb_monthly_every_day_",
            label: "Dia De Cada Mes",
          }),
          search.createColumn({
            name: "custrecord_sdb_event_weekly_check",
            label: "Evento Semanal",
          }),
          search.createColumn({
            name: "custrecord_sdb_last_day_month",
            label: "Ultimo dia del Mes",
          }),
          search.createColumn({
            name: "custrecord_sdb_biweekly_check",
            label: "Evento Quincenal",
          }),
          search.createColumn({
            name: "custrecord_sdb_first_biweekly_day",
            label: "Evento Dia De Primera Quincena",
          }),
          search.createColumn({
            name: "custrecord_sdb_first_biweekly_numeration",
            label: "El",
          }),
          search.createColumn({
            name: "custrecord_sdb_first_biweekly_billing",
            label: "Dia De Cada",
          }),
          search.createColumn({
            name: "custrecord_sdb_last_day_first_biweek",
            label: "Ultimo dia de Primera Quincena",
          }),
          search.createColumn({
            name: "custrecord_sdb_second_biweekly_day",
            label: "Dia De Segunda Quincena",
          }),
          search.createColumn({
            name: "custrecord_sdb_second_biweekly_billing",
            label: "Segunda Quincena Dia De Cada",
          }),
          search.createColumn({
            name: "custrecord_sdb_second_biweek_numeration",
            label: "Segunda Quincena El",
          }),
          search.createColumn({
            name: "custrecord_sdb_last_day_second_biweek",
            label: "Ultimo dia de Segunda Quincena",
          }),
        ],
      });
      var searchResultCount =
        customrecord_sdb_billing_calendarSearchObj.runPaged().count;
      let dataRcd = {};
      customrecord_sdb_billing_calendarSearchObj.run().each(function (result) {
        // .run().each has a limit of 4,000 results
        dataRcd.unic_event = result.getValue({
          name: "custrecord_sdb_unic_event_",
          label: "Evento Unico",
        });
        dataRcd.date_unic = result.getValue({
          name: "custrecord_sdb_unic_date",
          label: "Fecha Unica",
        });
        dataRcd.daily_event = result.getValue({
          name: "custrecord_sdb_daily_event_check",
          label: "Evento Diario",
        });
        dataRcd.daily_repeat = result.getValue({
          name: "custrecord_sdb_daily_event_repeat",
          label: "Repetir Cada dia",
        });
        dataRcd.daily_bussines_day = result.getValue({
          name: "custrecord_sdb_daily_repeat_bussines_day",
          label: "Repetir Cada dia Habil",
        });
        dataRcd.weekly_day = result.getText({
          name: "custrecord_sdb_weekly_day",
          label: "Dias de la Semana",
        });
        dataRcd.monthly_event = result.getValue({
          name: "custrecord_sdb_monthly_event",
          label: "Evento Mensual",
        });
        dataRcd.monthly_day_billing = result.getText({
          name: "custrecord_monthly_day_billing",
          label: "Dia de Cada",
        });
        dataRcd.date_create_transact = result.getValue({
          name: "custrecord_sdb_date_create_transact",
          label: "Fecha de Creacion",
        });
        dataRcd.monthly_numeration = result.getText({
          name: "custrecord_sdb_monthly_numeration",
          label: "El",
        });
        dataRcd.monthly_every_day = result.getValue({
          name: "custrecord_sdb_monthly_every_day_",
          label: "Dia De Cada Mes",
        });
        dataRcd.event_weekly = result.getValue({
          name: "custrecord_sdb_event_weekly_check",
          label: "Evento Semanal",
        });
        dataRcd.last_day_month = result.getValue({
          name: "custrecord_sdb_last_day_month",
          label: "Ultimo dia del Mes",
        });
        dataRcd.biweekly_event = result.getValue({
          name: "custrecord_sdb_biweekly_check",
          label: "Evento Quincenal",
        });
        dataRcd.first_biweekly_day = result.getValue({
          name: "custrecord_sdb_first_biweekly_day",
          label: "Evento Quincenal",
        });
        dataRcd.first_biweekly_numeration = result.getText({
          name: "custrecord_sdb_first_biweekly_numeration",
          label: "El",
        });
        dataRcd.first_biweekly_billing = result.getText({
          name: "custrecord_sdb_first_biweekly_billing",
          label: "Dia De Cada",
        });
        dataRcd.last_day_first_biweek = result.getValue({
          name: "custrecord_sdb_last_day_first_biweek",
          label: "Ultimo dia de Primera Quincena",
        });
        dataRcd.second_biweekly_day = result.getValue({
          name: "custrecord_sdb_second_biweekly_day",
          label: "Dia De Segunda Quincena",
        });
        (dataRcd.second_biweekly_billing = result.getText({
          name: "custrecord_sdb_second_biweekly_billing",
          label: "Segunda Quincena Dia De Cada",
        })),
          (dataRcd.second_biweek_numeration = result.getText({
            name: "custrecord_sdb_second_biweek_numeration",
            label: "Segunda Quincena El",
          })),
          (dataRcd.last_day_sd_second_biweek = result.getValue({
            name: "custrecord_sdb_last_day_second_biweek",
            label: "Ultimo dia de Segunda Quincena",
          }));
        return true;
      });
      log.debug(dataRcd);
      return dataRcd;
    }

    //------- AUXLIAR FUNCTIONS -------

    // Función que verifica si la fecha es sábado o domingo
    function isWeekend(dateObj) {
      const dayOfWeek = dateObj.getDay();
      return dayOfWeek === 0 || dayOfWeek === 6; // Domingo o Sábado
    }

    //  Sumar 1 día hábil
    function addBusinessDay(dateObj) {
      dateObj.setDate(dateObj.getDate() + 1);

      while (isWeekend(dateObj)) {
        dateObj.setDate(dateObj.getDate() + 1);
      }

      return dateObj;
    }

    return {
      dailyEventSetDate,
      weeklyEventSetDate,
      monthlyEventSetDate,
      getMonthlyWeekdayDate,
      biweeklyEventSetDate,
      getDateFormatted,
      searchBillingCalendar,
      unicEventSetDate,
    };
  });
