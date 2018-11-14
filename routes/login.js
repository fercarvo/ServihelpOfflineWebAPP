var express = require('express');
var router = express.Router();
var { pool, secret, sign_alg, session_timeout } = require('../util/DB.js');
const crypto = require('crypto');

router.use(function (req, res, next) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    next();
})


router.get('/login/', function(req, res, next) {
    res.render('login');
});

router.validarSesion = function (req, res, next) {    
    try {
        if (!req.cookies || !req.cookies.session_itsc)
            throw new Error('No existe cookie de sesion');

        req.session_itsc = readToken(req.cookies.session_itsc)
        next()

    } catch (e) {
        console.log(req.url)
        if (req.url === '/')
            return res.redirect('/login/')
        
        res.status(401).send('Unauthorized')
    }
}

router.get('/logout/', function (req, res, next) {
    res.clearCookie('session_itsc');
    res.redirect('/login/')
})

router.post('/login/', async function (req, res, next) {
    if (!req.body || !req.body.usuario || !req.body.clave)
        return res.redirect(`/login/?msg=${encodeURIComponent('Por favor, envie datos correctos')}`);

    try {
        if (req.body.seleccionar_rol === 'Y') { 
            //Recordar datos ultimo login
            var data = await checkUsuario(req.body.usuario, req.body.clave)

            if (data.length === 0) {
                return res.redirect(`/login/?msg=${encodeURIComponent('Usuario/Clave Incorrectos')}`) 
            } else {
                return res.render('rol', {
                    usr: req.body.usuario,
                    pass: req.body.clave,
                    roles: encodeURIComponent( JSON.stringify(data) )
                })
            }
            
        } else {
            //No recordar datos ultimo login
            var data_last_log = await getLastLogin(req.body.usuario, req.body.clave);
            
            if (data_last_log.length === 0) {
                return res.redirect(`/login/?msg=${encodeURIComponent('Usuario/Clave Incorrectos')}`);
            } else {
                var { ad_client_id, ad_role_id, ad_org_id } = data_last_log[0]

                if (Number(ad_org_id) === 0) {
                    return res.render('rol', {
                        usr: req.body.usuario,
                        pass: req.body.clave,
                        roles: encodeURIComponent( JSON.stringify(await checkUsuario(req.body.usuario, req.body.clave)) )
                    })
                } else {
                    var data_login = await createPayload(req.body.usuario, req.body.clave, ad_client_id, ad_role_id, ad_org_id)
                    var token = createToken(data_login)

                    res.cookie('session_itsc', token,  { 
                        maxAge: session_timeout,
                        httpOnly: true
                    })

                    res.redirect('/')
                }                
            }
        }

    } catch (e) {
        console.log(e)
        res.redirect(`/login/?msg=${encodeURIComponent(e.message)}`) 
    }    
})

router.post('/rol', async function (req, res, next) {
    console.log(req.body)
    if (!req.body || !req.body.usuario || !req.body.clave || !req.body.ad_client_id || !req.body.ad_role_id || !req.body.ad_org_id)
        return res.redirect(`/login?msg=${encodeURIComponent('Por favor, envie datos correctos')}`);

    try {
        var data = await createPayload(req.body.usuario, req.body.clave, req.body.ad_client_id, req.body.ad_role_id, req.body.ad_org_id, req.body.m_warehouse_id)
        var token = createToken(data)

        res.cookie('session_itsc', token,  { 
            maxAge: session_timeout, 
            httpOnly: true
        })
        res.send(token)  
        
    } catch (e) {
        console.log(e)
        res.redirect(`/login/?msg=${encodeURIComponent(e.message)}`) 
    }    
})

//Recibe un ID de usuario y retorna sus credenciales
async function getSecret (AD_User_ID) {
    var client = await pool.connect()

    var query = `    
        select
            c.user,
            c.password
        from vistasapp.vw_login_datos c 
        where c.ad_user_id = ${Number(AD_User_ID)}::integer`;
    
    var { rows } = await client.query(query);

    client.release();
    return rows[0]
}

//Recibe un usuario y clave, retorna los datos de rol asociados a los mismos
async function checkUsuario (usuario, clave) {
    var client = await pool.connect()

    var query = `    
        select
            AD_User_ID,
            name, 
            email,
            AD_Client_ID,
            grupo,
            ad_role_id,
            rol,
            AD_Org_ID,
            organizacion,
            m_warehouse_id,
            warehouse
        from vistasapp.vw_login_datos c 
        where c.user = '${usuario}' and c.password = '${clave}'`;
        
    var { rows } = await client.query(query);
    client.release();
    return rows
}

async function getLastLogin (usuario, clave) {
    var client = await pool.connect()
    var query = `
    select 
        s.createdby as AD_User_ID, 
        s.ad_client_id, 
        s.ad_org_id, 
        s.ad_role_id
    from AD_Session s
    inner join vistasapp.vw_login_datos lg on lg.ad_user_id = s.createdby
    where 
        lg.user = ('${usuario}')::text 
        and lg.password = ('${clave}')::text
    order by created desc
    limit 1
    `;
 
    var { rows } = await client.query(query);
    client.release();
    return rows
}

async function createPayload (usuario, clave, ad_client_id, ad_role_id, ad_org_id, m_warehouse_id) {
    var client = await pool.connect()
    var warehouse = Number.isInteger(Number(m_warehouse_id)) ? `and v.m_warehouse_id = ${m_warehouse_id}::numeric` : ""
    var query = `select
        v.AD_User_ID,
        v.name, 
        v.email,
        v.AD_Client_ID,
        v.grupo,
        v.ad_role_id,
        v.rol,
        v.AD_Org_ID,
        v.organizacion,
        v.m_warehouse_id,
        v.warehouse
    from vistasapp.vw_login_datos v
    where v.user = ('${usuario}')::text and v.password = ('${clave}')::text
        and v.ad_client_id = ${Number(ad_client_id)}::numeric
        and v.ad_role_id = ${Number(ad_role_id)}::numeric
        and v.AD_Org_ID = ${Number(ad_org_id)}::numeric
        ${warehouse}`;
    
    var { rows } = await client.query(query);

    if (rows.length === 0)
        throw new Error("Los parametros de entrada no coinciden.");

    var payload = rows[0]
    payload.iat = new Date();
    payload.lang = "es_EC"
    payload.stage = 0

    client.release();
    return payload
}


//Crea token de sesion
function createToken (json) {
    var hmac = crypto.createHmac(sign_alg, secret);
    var payload = JSON.stringify(json)
    var payload_base64 = Buffer.from(payload, 'utf8').toString('base64')

    hmac.update(payload, 'utf8');
    var sign = hmac.digest('base64');

    return encodeURIComponent(`${payload_base64}.${sign}`);
}

//Lee token de sesion, verifica y retorna payload
function readToken (text) {
    var hmac = crypto.createHmac(sign_alg, secret);
    var cookie = decodeURIComponent(text).split('.')

    if (cookie.length !== 2)
        throw new Error('Cookie invalida, no cumple formato');
    
    var payload_base64 = cookie[0]
    var sign = cookie[1]

    var payload =  Buffer.from(payload_base64, 'base64').toString('utf8')
    hmac.update(payload);

    if (hmac.digest('base64') !== sign)
        throw new Error('Firma invalida');

    return JSON.parse(payload)
}

module.exports = {router, getSecret};  