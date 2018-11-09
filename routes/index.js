var express = require('express');
var router = express.Router();
var login = require('./login').router

/* GET home page. */
router.get('/', login.validarSesion, function(req, res, next) {
  res.set('Cache-Control', 'private, max-age=60')
  res.render('index');
});

/*
async function webService (data) {
  var AD_User_ID = null;
  var AD_Org_ID = null;
  var m_warehouse_id = null;
  var user = null;
  var pass = null;
  var url = "sistema.ainteg.ec:8088/ADinterface/services/ModelADService"

   var xml = `
   <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:_0="http://idempiere.org/ADInterface/1_0">
      <soapenv:Header/>
      <soapenv:Body>
        <_0:runProcess>
          <_0:ModelRunProcessRequest>
            <_0:ModelRunProcess>
              <_0:serviceType>actualizaOrdenProcess</_0:serviceType>
              <_0:ParamValues>
                <_0:field column="data">
                  <_0:val>${data}</_0:val>
                </_0:field>
              </_0:ParamValues>
            </_0:ModelRunProcess>
            <_0:ADLoginRequest>
              <_0:user>SuperUser</_0:user>
              <_0:pass>SuperPROA*</_0:pass>
              <_0:lang>es_EC</_0:lang>
              <_0:ClientID>1000000</_0:ClientID>
              <_0:RoleID>1000000</_0:RoleID>
              <_0:OrgID>${AD_Org_ID}</_0:OrgID>
              <_0:WarehouseID>${m_warehouse_id || 0}</_0:WarehouseID>
              <_0:stage>0</_0:stage>
            </_0:ADLoginRequest>
          </_0:ModelRunProcessRequest>
        </_0:runProcess>
      </soapenv:Body>
    </soapenv:Envelope>`
}
*/

module.exports = router;
