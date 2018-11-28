angular.module('app', ['ui.router'])
    .config(["$stateProvider", "$compileProvider", function ($stateProvider, $compileProvider) {
        $stateProvider
            .state('proyectos', {
                url: '/proyectos',
                templateUrl: '/views/proyectos/listar.html',
                controller: 'proyectos'
            })

            .state('proyectos_descargados', { //proyectos_descargados.avance
                url: '/proyectos_descargados',
                templateUrl: '/views/proyectos/descargados.html',
                controller: 'proyectos_descargados'
            })
            
    }])
    .run(["$state", "$http", "$templateCache", "storage", async function ($state, $http, $templateCache, op) {

        try {
            var doc = await db.get('itsc-login-token')

            loadTemplates($state, "proyectos_descargados", $http, $templateCache)
        
        } catch (error) {
            console.error('err token itsc', error);
            window.location.replace(`/login/`)
        }
        
    }])
    .factory('storage', [function(){
        return { }
    }])
    .controller("proyectos", ["$scope", "$state", "$scope", function($scope, $state, $scope){
        console.log("Hola proyectos")

        $scope.proyectos = []

        fetch('/proyecto/', {credentials: "same-origin"})
            .then(async res => {
                if (res.ok) {
                    var { rows } = await res.json()
                    console.log(rows)
                    $scope.proyectos = rows
                    $scope.$apply()

                } else {
                    alert('Error en descargar proyectos')
                }
            })
            .catch(err => {
                console.error(err)
                alert(err.message)
            })



        $scope.descargar = async function (proyecto) {
            try {
                var data = await syncProyecto(proyecto)
                if (window.navigator.onLine) {
                    console.log('Proyecto descargado/actualizado exitosamente', data)
                    $.notify({
                        title: '<strong>Actualización exitosa</strong>',
                        message: 'Proyecto descargado/actualziado'
                    },{ type: 'success' })
                } else {
                    $.notify({
                        title: '<strong>Sin conexión</strong>',
                        message: 'El proyecto se encuentra descargado, pero no se ha podido actualizar.'
                    },{ type: 'warning' })
                }                 
            } catch (error) {
                $.notify({
                    title: '<strong>Ha ocurrido un error</strong>',
                    message: 'Error de sincronizacion'
                },{ type: 'danger' })
                console.error('Ha ocurrido un error', error)
            }
        }

         /*cargarTabla('proyectos', '/proyecto/', [
            {name: 'codigo', alias: 'Código'},
            {name: 'cliente', alias: 'Cliente'},
            {name: 'proyecto', alias: 'Proyecto'},
            {name: 'descripcion', alias: 'Descripción'},
            {name: 'fechacontrato', alias: 'Fecha Contrato'},
            {name: undefined, alias: 'Descargar', cb: data => `<button class="btn boton-itsc" onclick="cargarProyecto('${data}')">Descargar</button>`}
        ])*/



    }])
    .controller("proyectos_descargados", ["$scope", "$state", "storage", function($scope, $state, storage){
        $scope.proyectos = []
        $scope.informes = []
        
        var ubicaciones = [] //ubicaciones del proyecto
        var fases = [] //fases de la ubicacion y del proyecto
        var tareas = [] //tareas del proyecto seleccionado
        var lineas_tarea = [] //lineas del proyecto seleccionado

        $scope.proyecto_actual = null;
        $scope.informe_actual = null
        //$scope.ubicacion_seleccionada = null

        $scope.ubicaciones = []
        $scope.fases = []
        $scope.tareas = []
        $scope.lineas_tarea = []


        /**
         * Seccion proyectos
         */
        $scope.mostrar_proyectos = true
        
        $scope.ver_informes = async proyecto => {

            var data = await loadProyectoData(proyecto)
            $scope.mostrar_proyectos = false;
            $scope.mostrar_informes = true;
            //$('#informes_proyecto').modal('show')
            
            proyecto.informes.forEach(i => {
                if (typeof i.fecha === 'string' || i.fecha instanceof String) {
                    i.fecha = new Date(i.fecha)
                }
            })

            $scope.proyecto_actual = proyecto
            console.log('creando avance de proyecto', proyecto)

            ubicaciones = data.ubicaciones
            fases = data.fases
            tareas = data.tareas
            lineas_tarea = data.lineas_tarea
            
            $scope.ubicaciones = ubicaciones
            $scope.fases = fases
            $scope.tareas = tareas
            $scope.lineas_tarea = lineas_tarea

            $scope.$apply()
        }

        $scope.guardar_localmente = async (proyecto, alerta) => {
            try {
                var p_to_save = {}

                for (var key in proyecto) {
                    p_to_save[key] = proyecto[key]
                }
                
                delete p_to_save['$$hashKey']
                p_to_save.informes = proyecto.informes.map(i => {
                    return {
                        documentno: i.documentno,
                        s_timeexpense_id: i.s_timeexpense_id,
                        descripcion: i.descripcion,
                        fecha: i.fecha,
                        tercero: i.tercero,
                        trabajo_realizado: i.trabajo_realizado,
                        observacion_cliente: i.observacion_cliente,
                        datos_tecnicos: i.datos_tecnicos,
                        lineas: i.lineas.map(l => {
                            return {
                                ubicacion: l.ubicacion,
                                fase: l.fase,
                                producto: l.producto,
                                tarea: l.tarea,
                                qty: l.qty
                            }
                        }),
                        asistencias: i.asistencias.map(a => {
                            return {
                                tercero: a.tercero,
                                fecha: a.fecha,
                                desde: a.desde,
                                hasta: a.hasta
                            }
                        })
                    }
                })

                await storageProyecto(p_to_save)
                if (alerta) {
                    alert("Avance guardado localmente")
                } else {
                    $.notify({ title: '<strong>Avance guardado localmente</strong>', message: ''},{ type: 'success' })
                }

            } catch (error) {
                console.log('Error', error)
                if (alerta) {
                    alert('Error guardar poryecto '+ error)
                } else {
                    $.notify({title: '<strong>Error guardar avance localmente</strong>', message: error ? error:''},{ type: 'danger' })
                }                
            }            
        }

        $scope.sincronizar = async (proyecto, informe) => {
            try {
                var respuesta = await guardarInfoGasto(proyecto.c_project_id, informe.s_timeexpense_id, informe.fecha, informe.descripcion, informe.lineas, informe.asistencias)
                respuesta = respuesta.split('___')

                informe.s_timeexpense_id = Number(respuesta[0])
                informe.documentno = respuesta[1]
                $scope.$apply()

                $.notify({ title: '<strong>Sincronizado con el servidor</strong>', message: ''},{ type: 'success' })

                $scope.guardar_localmente(proyecto)

            } catch (error) {
                console.log('error', error)
                $.notify({ title: '<strong>Error de sincronizacion</strong>', message: `${error}`},{ type: 'danger' })
            }
        }





        /**
         * Seccion Informes
         */
        $scope.eliminar_informe = removeIndex;

        $scope.nuevo_informe = function () {
            if ($scope.proyecto_actual) {
                $scope.proyecto_actual.informes.push({
                    documentno: undefined,
                    s_timeexpense_id: 0,
                    descripcion: undefined,
                    fecha: new Date(),
                    tercero: undefined,
                    trabajo_realizado: undefined,
                    observacion_cliente: undefined,
                    datos_tecnicos: undefined,
                    lineas: [],
                    asistencias: []
                })

            } else {
                alert('Seleccione un proyecto')
            }
        }

        $scope.ver_lineas_informe = function (informe) {
            $scope.informe_actual = informe

            if ($scope.ubicacion_seleccionada === undefined) {
                $scope.ubicacion_seleccionada = $scope.ubicaciones[0]
                $scope.cambio_ubicacion($scope.ubicacion_seleccionada)
            }

            $('#lineas_informe_proyecto').modal('show')
        }

        
        $scope.ver_lineas_asistencias = function (informe) {
            $scope.informe_actual = informe

            console.log('cabecera actual', $scope.informe_actual)

            $('#lineas_registro_empleados').modal('show')
        }
        
        $scope.editar_informe = function (informe) {
            $scope.informe_actual = informe
            $('#cabecera_informe').modal('show')
            console.log('Editando informe....')
        }

        /**
         * Seccion lineas asistencias
         */

        $scope.fecha = new Date()
        $scope.desde = moment().startOf('day').add(8, 'hours').toDate() //8 de la manana
        $scope.hasta = moment().startOf('day').add(17, 'hours').toDate() //5 de la tarde

        $scope.cambio_desde = desde => {
            console.log(desde)
        }

        $scope.cambio_hasta = (hasta) => {
            $scope.hasta_max = hasta.toISOString()
            console.log($scope.hasta_max)
        }

        $scope.terceros = []

        $scope.nuevo_registro = function (tercero, fecha, desde, hasta) {

            $scope.informe_actual.asistencias.push({
                tercero: tercero,
                fecha: moment( fecha ).local().format('YYYY-MM-DD'), 
                desde: moment( desde ).local().format('HH:mm:ss'),
                hasta: moment( hasta ).local().format('HH:mm:ss')
            })
        }

        /**
         * Seccion lineas informe
         */

        $scope.generar_todos = function (ubicacion_seleccionada, fase_seleccionada) {
            var tareas_filtro = tareas.filter(t => t.c_projectphase_id == fase_seleccionada.c_projectphase_id)

            for (var tarea_seleccionada of tareas_filtro) {
                var productos = lineas_tarea.filter(l => l.c_projecttask_id == tarea_seleccionada.c_projecttask_id)
                for (var producto of productos) {
                    $scope.nueva_linea(ubicacion_seleccionada, fase_seleccionada, tarea_seleccionada, producto)
                }
            }
        }


        $scope.nueva_linea = function (ubi, fas, tar, prod) {
            let new_ubicacion = {
                ubicacion: ubi.ubicacion,
                tb_proyecto_ubicaciones_id: ubi.tb_proyecto_ubicaciones_id
            }

            let new_fase = {
                fase: fas.fase,
                c_projectphase_id: fas.c_projectphase_id
            }

            let new_tarea = {
                tarea: tar.tarea,
                c_projecttask_id: tar.c_projecttask_id
            }

            let new_producto = {
                c_projectline_id: prod.c_projectline_id,
                producto: prod.producto,
                m_product_id: prod.m_product_id,
                plannedamt: prod.plannedamt,
                plannedprice: prod.plannedprice,
                plannedqty: prod.plannedqty,
                codigo: prod.codigo
            }
            var new_data = {
                ubicacion: new_ubicacion,
                fase: new_fase,
                tarea: new_tarea,
                producto: new_producto,
                qty: undefined
            }

            $scope.informe_actual.lineas.push(new_data)
        }

        $scope.eliminar_linea = removeIndex

        $scope.cambio_ubicacion = function (ubicacion_seleccionada) {
            if (ubicacion_seleccionada === undefined) {
                $scope.fases = []
            } else {
                $scope.fases = fases.filter(f => f.tb_proyecto_ubicaciones_id == ubicacion_seleccionada.tb_proyecto_ubicaciones_id)
            }

            $scope.fase_seleccionada = $scope.fases[0]
            $scope.cambio_fase($scope.fase_seleccionada)

        }

        $scope.cambio_fase = function (fase_seleccionada) {
            if (fase_seleccionada === undefined) {
                $scope.tareas = []
            } else {
                $scope.tareas = tareas.filter(t => t.c_projectphase_id == fase_seleccionada.c_projectphase_id)
            }

            $scope.tarea_seleccionada = $scope.tareas[0]
            $scope.cambio_tarea($scope.tarea_seleccionada)
        }

        $scope.cambio_tarea = function (tarea_seleccionada) {
            if (tarea_seleccionada === undefined) {
                $scope.lineas_tarea =  []
            } else {
                $scope.lineas_tarea = lineas_tarea.filter(l => l.c_projecttask_id == tarea_seleccionada.c_projecttask_id)
            }

            $scope.producto_seleccionado = $scope.lineas_tarea[0]
        }
        
        ///////////////////////////////////////////////////
        
        getProyectos()
            .then(data => {
                console.log('descargados', data)
                $scope.proyectos = data
                $scope.proyectos.forEach(p => {
                    if (p.informes === undefined) {
                        p.informes = []
                    }
                })
                $scope.$apply();
            })
            .catch(error => console.log('error cargar', error))

        fetch('/empleados/', {credentials: "same-origin"})
            .then(async res => {
                if (res.ok) {
                    var data = await res.text()
                    $scope.terceros = JSON.parse(data)
                    $scope.$apply()
                } else {
                    alert('NO se pudo cargar los empleados')
                }
            })


        function removeIndex(index, array) {
            array.splice(index, 1)
        }

        $scope.foo = function () {
            console.log('nada...')
        }

    }])

/**
 * Funcion que pre-carga todos los archivos estaticos de AngularJS
 * @param {*} $state 
 * @param {*} goState 
 * @param {*} $http 
 * @param {*} $templateCache 
 */
async function loadTemplates($state, goState, $http, $templateCache) {
    try {
        var promises = []
        var states = $state.get()

        for (i = 1; i < states.length; i++) {
            var p = $http.get(states[i].templateUrl, { cache: $templateCache })
            promises.push(p)
            p.then(function () { }, function (error) { console.log("Error template: ", error) })
        }

        await Promise.all(promises)
                
    } catch (e) {
        console.log("Error templates catch: " + e)
    } finally {
        $state.go(goState) ///////////////////////// State inicial
        document.body.style.pointerEvents = "all"
    }
    
}

async function cargarProyecto (data) {
    data = leer(data)

    try {
        var data = await syncProyecto(data)
        if (window.navigator.onLine) {
            console.log('Proyecto descargado/actualizado exitosamente', data)
            $.notify({
                title: '<strong>Actualización exitosa</strong>',
                message: 'Proyecto descargado/actualziado'
            },{ type: 'success' })
        } else {
            $.notify({
                title: '<strong>Sin conexión</strong>',
                message: 'El proyecto se encuentra descargado, pero no se ha podido actualizar.'
            },{ type: 'warning' })
        }                 
    } catch (error) {
        $.notify({
            title: '<strong>Ha ocurrido un error</strong>',
            message: 'Error de sincronizacion'
        },{ type: 'danger' })
        console.error('Ha ocurrido un error', error)
    }
}

/**
 * guardarInfoGasto sincroniza con el servidor los informes de gasto
 * @param {*} proyecto_id 
 * @param {*} s_timeexpense_id 
 * @param {*} fecha_infogasto 
 * @param {*} descripcion 
 * @param {*} lineas
 * @param {Array<*>} asistencias Asistencias a ser guardadas 
 */
async function guardarInfoGasto(proyecto_id, s_timeexpense_id, fecha_infogasto, descripcion, lineas, asistencias) {

    s_timeexpense_id = Number(s_timeexpense_id)
    proyecto_id = Number(proyecto_id)
    descripcion = `${descripcion ? descripcion : ''}`

    lineas = lineas.map(linea => {
        return {
            c_projectline_id: Number(linea.producto.c_projectline_id),
            qty: Number(linea.qty)
        }
    })

    asistencias = asistencias.map(es => {
        return {
            fecha: es.fecha,
            desde: es.desde,
            hasta: es.hasta,
            tercero: Number(es.tercero.c_bpartner_id)
        }
    })

    var response = await fetch(`/proyecto/avance/${proyecto_id}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({descripcion, s_timeexpense_id, fecha_infogasto, lineas, asistencias})
    })

    if (response.ok) {
        return await response.text()
    } else {
        console.log(response.status)
        throw new Error(await response.text())
    }  
    
}

function getProyectos (c_project_id) {
    function mapProyecto (doc) {
        if (doc.type === 'proyecto') {
            emit(doc)
        }
    }

    return new Promise((resolve, reject) => {
        db.query(mapProyecto, { include_docs: true }, function (err, response) {
            if (err) return reject(err);

            if (c_project_id) {
                var rows = response.rows.filter(res => res.doc.c_project_id === c_project_id)
                resolve(rows.map(r => r.doc))
            } else {
                resolve(response.rows.map(r => r.doc))
            }           
        })
    })    
}

function storageProyecto (data) {
    return new Promise((resolve, reject) => {

        getProyectos(data.c_project_id).then(async proyectos => {
            if (proyectos.length > 0) {
                
                var doc = proyectos[0]
                var to_save = {...data}
                to_save._id = doc._id
                to_save._rev = doc._rev

                try { 
                    await db.put({ ...to_save, type: 'proyecto'})
                    resolve()
                } catch (error) {
                    console.log(error)
                    reject('Error actualizar proyecto')
                }
            } else {
                try {
                    await db.post({...data, type: 'proyecto'})
                    resolve()
                } catch (error) {
                    console.log('error crear proyecto', error)
                    reject('error crear proyecto '+_id)
                }
            }
        }).catch(err => reject(err))

    })
}

async function loadProyectoData (proyecto) {
    var id = proyecto.c_project_id
    var data = await fetch(`/proyecto/${id}`, {credentials: "same-origin"})

    if (data.ok)
        data = await data.json();
    else
        throw new Error(`Status: ${data.status}, ${data.statusText}`);

    data = [...data.rows]

    if (data.length === 0)
        return null;

    var ubicaciones_id = new Set( data.map(row => row.tb_proyecto_ubicaciones_id).filter(id => Number(id) >= 1000000) )
    var fases_id = new Set( data.map(row => row.c_projectphase_id).filter(id => Number(id) >= 1000000) )
    var tareas_id = new Set( data.map(row => row.c_projecttask_id).filter(id => Number(id) >= 1000000) )
    var productos_id = new Set( data.map(row => row.m_product_id).filter(id => Number(id) >= 1000000) )

    var ubicaciones = [...ubicaciones_id].map(id => data.find(row => row.tb_proyecto_ubicaciones_id === id))
    var fases = [...fases_id].map(id => data.find(row => row.c_projectphase_id === id))
    var tareas = [...tareas_id].map(id => data.find(row => row.c_projecttask_id === id))
    var lineas_tarea = [...productos_id].map(id => data.find(row => row.m_product_id === id))

    ubicaciones = ubicaciones.map(row => {
        return {
            tb_proyecto_ubicaciones_id: Number(row.tb_proyecto_ubicaciones_id),
            ubicacion: row.ubicacion,
            c_project_id: Number(row.c_project_id)
        }
    })

    //Fases del proyecto
    fases = fases.map(row => {
        return {
            c_project_id: Number(row.c_project_id),
            tb_proyecto_ubicaciones_id: Number(row.tb_proyecto_ubicaciones_id),
            fase: row.fase,
            c_projectphase_id: Number(row.c_projectphase_id)
        }
    }) 

    //Tareas
    tareas = tareas.map(row => {
        return {
            c_projectphase_id: Number(row.c_projectphase_id),
            tarea: row.tarea,
            c_projecttask_id: Number(row.c_projecttask_id)
        }
    })

    //Lineas de tarea
    lineas_tarea = lineas_tarea.map(row => {
        return {
            c_projecttask_id: Number(row.c_projecttask_id),
            c_projectline_id: Number(row.c_projectline_id),
            codigo: row.codigo,
            m_product_id: Number(row.m_product_id),
            producto: row.producto,
            unidad: row.unidad,
            plannedqty: Number(row.plannedqty),
            plannedprice: Number(row.plannedprice),
            plannedamt: Number(row.plannedamt) //total planeado
        }
    })

    return {ubicaciones, fases, tareas, lineas_tarea}
}


async function syncProyecto(proyecto) { 
    var id = proyecto.c_project_id
    var data = await fetch(`/proyecto/${id}`, {credentials: "same-origin"})

    if (data.ok)
        data = await data.json();
    else
        throw new Error(`Status: ${data.status}, ${data.statusText}`);

    await storageProyecto(proyecto)
}

async function cargarTabla (id, url, arrColumnas) {

    function escribir( json ) {
        return window.btoa(unescape(encodeURIComponent( JSON.stringify(json) )));
    }

    try {
        var data = await fetch(url, {credentials: "same-origin"})

        if (data.ok)
            data = await data.json();
        else
            throw new Error(`Status: ${data.status}, ${data.statusText}`);

        document.getElementById(id).innerHTML = `
            <thead>
                <tr>
                    ${arrColumnas.reduce((html, obj) => {
                        return html + `<th> ${obj.alias} </th>`;
                    }, '')}
                </tr>
            </thead>
            <tbody>
                ${data.rows.reduce((html, row) => {
                    return html + `
                        <tr> 
                            ${arrColumnas.reduce((htmlr, obj) => {
                                return htmlr + `
                                <td> ${obj.name ? (row[obj.name] || '') : obj.cb(escribir(row))} </td>`;        
                            }, '')}
                        </tr>`;
                }, '')}
            </tbody>
        `;
        
        $(`#${id}`).DataTable({ 
            responsive: true,
            language: {
                "emptyTable":   	"No existe información para mostrar",
                "info":         	"Mostrando página _PAGE_ de _PAGES_",
                "infoEmpty":    	"No existe información para mostrar",
                "infoFiltered": 	"(Filtrado de _MAX_ registros)",
                "lengthMenu":   	"Mostrar _MENU_ registros por página",
                "search":       	"Buscar",
                "zeroRecords":  	"La busqueda no encontró resultados",
                "paginate": {
                    "first":    	"Primero",
                    "previous": 	"Anterior",
                    "next":     	"Siguiente",
                    "last":     	"Último"
                }
            }
        })

    } catch (e) {
        console.log(e);
        alert(e.message)
    }
}



function leer( str ) {
    return JSON.parse( decodeURIComponent(escape(window.atob( str ))) )
}