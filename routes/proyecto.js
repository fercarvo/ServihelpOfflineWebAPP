var express = require('express');
var router = express.Router();
var login = require('./login').router
var { getSecret } = require('./login')
//var { requestWS } = require('./webservice')
var { pool, url } = require('../util/DB.js');
var { requestWS } = require('NodeJS_iDempiereWebService')
var moment = require('moment')

//console.log(foo)

router.get('/proyecto/', login.validarSesion, async (req, res, next) => {
    try {
        var query = `select * from vw_proyecto`;
        var data = await pool.query(query);
        res.json(parseDBdata(data));  
    } catch (e) {
        next(e)
    }
})

router.get('/proyecto/:id', login.validarSesion, async (req, res, next) => {
    var id_proyecto = Number(req.params.id)

    try {
        var query = `select * from vw_proyectodetalle where c_project_id = (${id_proyecto})::integer`;
        var data = await pool.query(query);
        res.json(parseDBdata(data));  
    } catch (e) {
        next(e)
    }
})


router.post("/proyecto/avance/:id/", login.validarSesion, async (req, res, next) => {
    try {
        var id_proyecto = Number(req.params.id);
        var id_infogasto = Number(req.body.s_timeexpense_id)
        var fecha_infogasto = moment( new Date(req.body.fecha_infogasto) ).format('YYYY-MM-DD hh:mm:ss')
        var descripcion = req.body.descripcion
        
        console.log(req.body)
              
        var lineas_proyecto_id = req.body.lineas.map(l => Number(l.c_projectline_id)).join('_')
        var cantidades = req.body.lineas.map(l => Number(l.qty)).join('_')

        var {user, password} = await getSecret(req.session_itsc.ad_user_id);

        var params = [
            {column: "C_Project_ID", val: id_proyecto},
            {column: "S_TimeExpense_ID", val: id_infogasto},
            {column: "fecha_infogasto", val: fecha_infogasto},
            {column: "Description", val: descripcion},
            {column: "lineas_proyecto_id", val: lineas_proyecto_id},
            {column: "cantidades", val: cantidades}
        ]

        console.log('params', params)

        var data = await requestWS(url, "crear_avance_proyecto_ws", req.session_itsc, user, password, params)
        res.send(data);

    } catch (e) {
        console.log(e)
        next(new Error(e)) 
    }    
})


function parseDBdata (data) {
    return {
        fields: data.fields.map(f => f.name),
        rows: data.rows
    }
}


module.exports = router;