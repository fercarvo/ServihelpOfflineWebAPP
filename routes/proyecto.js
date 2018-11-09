var express = require('express');
var router = express.Router();
var login = require('./login').router
var { getSecret } = require('./login')
//var { requestWS } = require('./webservice')
var { pool, url } = require('../util/DB.js');
//var foo = require('NodeJS_iDempiereWebService')

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


router.post("/gestion/:id/nueva", login.validarSesion, async (req, res, next) => {
    try {
        var actividad = Number(req.params.id);
        var tipo_actividad = req.body.tipo_actividad
        var fecha = req.body.fecha
        var descripcion = req.body.descripcion
        var siguiente_ac = req.body.siguiente_ac
        var f_siguiente_ac = req.body.f_siguiente_ac

        var {user, password} = await getSecret(req.session_itsc.ad_user_id);

        var params = [
            {column: "C_ContactActivity_ID", val: actividad},
            {column: "ContactActivityType", val: tipo_actividad},
            {column: "StartDate", val: fecha},
            {column: "Description", val: descripcion},
            {column: "next_activity", val: siguiente_ac},
            {column: "EndDate", val: f_siguiente_ac}
        ]

        var data = await requestWS(url, "CrearGestion", req.session_itsc, user, password, params)
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