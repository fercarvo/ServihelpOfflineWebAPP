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


router.get('/login/rol/data/', async function (req, res, next) {
    try {

        if (!req.query.usuario || !req.query.clave || !req.query.ad_client_id || !req.query.ad_role_id || !req.query.ad_org_id)
            throw new Error('Por favor, envie datos correctos')

        var data = await createPayload(
            req.query.usuario, 
            req.query.clave, 
            req.query.ad_client_id, 
            req.query.ad_role_id, 
            req.query.ad_org_id, 
            req.query.m_warehouse_id
        )

        var token = createToken(data)

        res.cookie('session_itsc', token,  { 
            maxAge: session_timeout, 
            httpOnly: true
        })

        res.send(token)  
        
    } catch (e) {
        console.error(e)
        next(new Error(e))
    }    
})

router.get('/login/data/', async function (req, res, next) {
    try {
        var resultado = await requestLogin(req.query.usuario, req.query.clave, req.query.seleccionar_rol)

        if (typeof resultado === 'string' || resultado instanceof String) { //Es un token
            res.cookie('session_itsc', resultado,  { 
                maxAge: session_timeout,
                httpOnly: true
            })

            res.json({token: resultado})
        
        } else { //Es payload de rol
            res.json({...resultado})
        }

    } catch (e) {
        console.log(e)
        next(e) 
    }
})


/**
 * Funcion que administra el requerimiento de login
 * 
 * @param {string} usuario 
 * @param {string} clave 
 * @param {string} seleccionar_rol
 * @returns Token o Payload de los roles del usuario
 */
async function requestLogin (usuario, clave, seleccionar_rol) {
    if (!usuario || !clave)
        throw new Error('Por favor, envie datos correctos')

    if (seleccionar_rol === 'Y') { 
        //Recordar datos ultimo login
        var data = await checkUsuario(usuario, clave)

        if (data.length === 0) {
            throw new Error('Usuario/Clave Incorrectos')
        } else {
            return {
                usr: usuario,
                pass: clave,
                roles: data
            }
        }
        
    } else {
        //No recordar datos ultimo login
        var data_last_log = await getLastLogin(usuario, clave);
        
        if (data_last_log === undefined) {
            throw new Error('Usuario/Clave Incorrectos')
        } else {
            var { ad_client_id, ad_role_id, ad_org_id } = data_last_log

            if (Number(ad_org_id) === 0) {
                return {
                    usr: usuario,
                    pass: clave,
                    roles: await checkUsuario(usuario, clave)
                }
            } else {
                var data_login = await createPayload(usuario, clave, ad_client_id, ad_role_id, ad_org_id)
                var token = createToken(data_login)

                return token
            }                
        }
    }
}

/**
 * Funcion que obtiene credenciales de un usuario
 * 
 * @param {Number} AD_User_ID ID del usuario  de iDempiere
 * @returns {Promise<{user:string, password:string}>} credenciales
 */
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

/**
 * Funcion que verifica login contra base de datos del sistema iDempiere
 * Requiere de una vista vw_login_datos creada especialmente para ITSC S.A.
 * 
 * @param {string} usuario nombre de usuario de idempiere 
 * @param {clave} clave clave del sistema de idempiere
 * @returns {Promise<[]>} Arreglo de Informacion de Grupos empresarial, Roles, Organizaciones y Warehouses del usuario y clave ingresados
 */
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
        where c.user = ('${usuario}')::text and c.password = ('${clave}')::text`;
        
    var { rows } = await client.query(query);
    client.release();
    return rows
}

/**
 * Funcion que retorna los datos del ultimo login del usuario con credenciales ingresadas o undefined
 *  
 * @param {string} usuario nombre de usuario de idempiere 
 * @param {string} clave clave del sistema de idempiere
 * @returns {Promise<{ad_user_id:string, ad_client_id:string, ad_org_id:string, ad_role_id:string}>}
 */
async function getLastLogin (usuario, clave) {
    var client = await pool.connect()
    var query = `
    select 
        s.createdby as ad_user_id, 
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
    return rows[0]
}

/**
 * Funcion que toma datos del usuario y crea un payload que sera usado posteriormente para crear el token de sesion
 * este contiene toda la informacion que se usara posteriormente
 * 
 * @param {string} usuario usuario idempiere
 * @param {string} clave clave del sistema idempiere
 * @param {number} ad_client_id Grupo empresarial del usuario
 * @param {number} ad_role_id Rol del usuario
 * @param {number} ad_org_id Organizacion del usuario
 * @param {number} m_warehouse_id warehouse del usuario
 * @returns {Promise<{}>} Payload de sesion, es decir toda la info del usuario logeado
 */
async function createPayload (usuario, clave, ad_client_id, ad_role_id, ad_org_id, m_warehouse_id) {
    var client = await pool.connect()
    var warehouse = Number(m_warehouse_id) > 0 ? `and v.m_warehouse_id = ${m_warehouse_id}::integer` : ""

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
        and v.ad_client_id = ${Number(ad_client_id)}::integer
        and v.ad_role_id = ${Number(ad_role_id)}::integer
        and v.AD_Org_ID = ${Number(ad_org_id)}::integer
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


/**
 * Funcion que obtiene un JSON y lo transforma en un token firmado
 * 
 * @param {{}} json Data JSON
 * @returns {string} <payloadBase64>.<firma>
 */
function createToken (json) {
    var hmac = crypto.createHmac(sign_alg, secret);
    var payload = JSON.stringify(json)
    var payload_base64 = Buffer.from(payload, 'utf8').toString('base64')

    hmac.update(payload, 'utf8');
    var sign = hmac.digest('base64');

    return encodeURIComponent(`${payload_base64}.${sign}`);
}

/**
 * Funcion que verifica la informacion de un token y retorna su payload
 * 
 * @param {string} token Token en formato <payloadBase64>.<firma>
 * @returns {{}} Payload, data en JSON
 * @throws {Error} En caso de token invalido o alterado
 */
function readToken (token) {
    var hmac = crypto.createHmac(sign_alg, secret);
    var cookie = decodeURIComponent(token).split('.')

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