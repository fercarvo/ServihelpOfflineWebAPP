var express = require('express');
var router = express.Router();
var { github_secret, project_refresh_scripts } = require('../util/DB.js')
const { exec } = require('child_process');

router.post('/github/webhook', function(req, res, next) {
    //var hmac = crypto.createHmac('SHA1', github_secret);
    //var github_header = req.headers['X-Hub-Signature']

    //hmac.update(`sha=${github_header}`)

    //console.log('github webhooks...')
    //console.log(req.headers)

    //if (github_header && github_header === hmac.digest('hex')) {
        //console.log('Ejecutando...')
        /*exec(project_refresh_scripts, (error, stdout, stderr) => {
            if (error) {
              console.error(`exec error: ${error}`);
              return;
            }
            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);
        });

        res.send('Ok')*/
    //} else {
    //    console.log('No autorizado...')
    //    res.status(401).send('Unauthorized')
    //}
    res.send('Ok');
})

module.exports = router;