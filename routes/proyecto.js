var express = require('express');
var router = express.Router();
var login = require('./login').router
var { getSecret } = require('./login')
//var { requestWS } = require('./webservice')
var { pool, url } = require('../util/DB.js');
var { requestWS } = require('nodejs_idempierewebservice')
var moment = require('moment')
var fs = require('fs');


router.get('/proyecto/', login.validarSesion, async (req, res, next) => {
    try {
        var query = `select * from vw_proyecto`;
        var data = await pool.query(query);
        res.json(parseDBdata(data));  
    } catch (e) {
        console.error(e)
        next(e)
    }
})

router.get('/proyecto/:id', login.validarSesion, async (req, res, next) => {
    var id_proyecto = Number(req.params.id)

    try {
        var query = `select * from vw_proyectodetalle_2 where c_project_id = (${id_proyecto})::integer`;
        var data = await pool.query(query);
        res.json(parseDBdata(data));  
    } catch (e) {
        console.error(e)
        next(e)
    }
})

router.get('/empleados/', login.validarSesion, async function (req, res, next) {
    var ad_client_id = Number(req.session_itsc.ad_client_id)

    try {
        var query = `
            select 
                c.c_bpartner_id, 
                c.name 
            from c_bpartner c 
            where 
                c.isemployee = 'Y' 
                and c.isactive = 'Y'
                and c.ad_client_id = ${ad_client_id}::integer
                and c.c_bpartner_id IN (
                    select hr.C_BPartner_ID 
                    from HR_Employee hr 
                    where 
                        hr.C_BPartner_ID = c.C_BPartner_ID 
                        and hr.ad_client_id = ${ad_client_id}::integer
                        and hr.EndDate is null
                )`;
                
        var { rows } = await pool.query(query);
        
        res.set('Cache-Control', 'private, max-age=60')
        res.json(rows);

    } catch (e) {
        console.error(e)
        next(e)
    }
})

router.post("/proyecto/avance/:id/", login.validarSesion, async (req, res, next) => {
    var filename = undefined;
    try {
        var id_proyecto = Number(req.params.id);
        var id_infogasto = Number(req.body.s_timeexpense_id)
        var fecha_infogasto = moment( new Date(req.body.fecha_infogasto) ).local().format('YYYY-MM-DD') + ' 00:00:00'
        var descripcion = req.body.descripcion
        var c_bpartner_id = req.body.tercero
        var trabajo_realizado = req.body.trabajo_realizado
        var observacion_cliente = req.body.observacion_cliente
        var datos_tecnicos = req.body.datos_tecnicos
        
        if (!Array.isArray(req.body.lineas) || req.body.lineas.length === 0)
            throw new Error('No existen lineas de Avance')

        var json = {
            lineas: [...req.body.lineas],
            asistencias: [...req.body.asistencias]
        }
        var filename = await createFile(JSON.stringify(json));

        var {user, password} = await getSecret(req.session_itsc.ad_user_id);

        var params = [
            {column: "C_Project_ID", val: id_proyecto},
            {column: "S_TimeExpense_ID", val: id_infogasto},
            {column: "fecha_infogasto", val: fecha_infogasto},
            {column: "Description", val: descripcion},

            {column: 'C_BPartner_ID', val: c_bpartner_id},
            {column: 'trabajo_realizado', val: trabajo_realizado},
            {column: 'observacion_cliente', val: observacion_cliente},
            {column: 'datos_tecnicos', val: datos_tecnicos},
            
            {column: 'URL', val: `https://proyservihelpdes.itsc.ec/data/${filename}`}
        ]

        console.log('params', params)

        var data = await requestWS(url, "crear_avance_proyecto_ws", {...req.session_itsc, username: user, password}, params)
        res.send(data);

    } catch (e) {
        console.error(e)
        next(new Error(e)) 
    } finally {
        if (filename)
            fs.unlink(`./public/data/${filename}`, err => err ? console.error("Err Eliminar", err) : console.log('eliminado', filename))
    }    
})

/**
 * Crea un archivo con nombre aleatorio
 * @param {string} data informacion que se escribe en el archivo 
 * @returns {string} file name
 */
function createFile (data) {
    return new Promise((resolve, reject) => {
        var filename = randomName()+".json"
        fs.writeFile(`./public/data/${filename}`, data, function(err) {
            if (err)
                return reject(`${err}`);
            
            resolve(filename)
        }) 
    }) 
}

function randomName () {
    var text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  
    for (var i = 0; i < 30; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  
    return text;
}


function parseDBdata (data) {
    return {
        fields: data.fields.map(f => f.name),
        rows: data.rows
    }
}


module.exports = router;