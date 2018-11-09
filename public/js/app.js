angular.module('app', ['ui.router'])
    .config(["$stateProvider", "$compileProvider", function ($stateProvider, $compileProvider) {
        $stateProvider
            .state('proyectos', {
                templateUrl: '/views/proyectos/listar.html',
                controller: 'proyectos'
            })
            .state('proyectos.cargar', {
                templateUrl: '/views/proyectos/cargar_proyecto.html',
                controller: 'proyectos.cargar'
            })  
            .state('proyectos_descargados', { //proyectos_descargados.avance
                templateUrl: '/views/proyectos/descargados.html',
                controller: 'proyectos_descargados'
            })
            .state('proyectos_descargados.avance', {
                templateUrl: '/views/proyectos/informes_proyecto.html',
                controller: 'proyectos_descargados.avance'
            })
            .state('proyectos_descargados.avance.lineas', {
                templateUrl: '/views/proyectos/lineas_nformes_proyecto.html',
                controller: 'proyectos_descargados.avance.lineas'
            })
            
    }])
    .run(["$state", "$http", "$templateCache", "storage", async function ($state, $http, $templateCache, op) {

        try {
            var doc = await db.get('itsc-login-token')
            console.log('token', doc)

            EventBus.addEventListener("newState", cambiar)

            function cambiar(evt, data) {
                op.data = data;
                $state.go(evt.target);
            }

            loadTemplates($state, "proyectos", $http, $templateCache)
        
        } catch (error) {
            console.log('err token itsc', error);
            window.location.replace(`/login/`)
        }
        
    }])
    .factory('storage', [function(){
        return { }
    }])
    .controller("proyectos", ["$scope", "$state", "$scope", function($scope, $state, $scope){
        console.log("Hola proyectos")

         cargarTabla('proyectos', '/proyecto/', [
            {name: 'codigo', alias: 'Código'},
            {name: 'cliente', alias: 'Cliente'},
            {name: 'proyecto', alias: 'Proyecto'},
            {name: 'descripcion', alias: 'Descripción'},
            {name: 'fechacontrato', alias: 'Fecha Comtrato'},
            {name: 'fechaterminacion', alias: 'Fecha Terminacion'},
            {name: 'asesor', alias: 'Asesor'},
            {name: 'totalplaneado', alias: 'Total Planeado'},
            {name: undefined, alias: 'Descargar', cb: data => `<button class="btn boton-itsc" onclick="cargarProyecto('${data}')">Descargar</button>`}
        ])



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

        /**
         * Seccion proyectos
         */
        $scope.ver_informes = async proyecto => {
            var data = await loadProyectoData(proyecto)
            $('#informes_proyecto').modal('show')
            
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

            $scope.$apply()
        }

        $scope.guardar_localmente = async proyecto => {
            try {
                var p_to_save = {}

                for (var key in proyecto) {
                    p_to_save[key] = proyecto[key]
                }
                
                delete p_to_save['$$hashKey']
                p_to_save.informes = proyecto.informes.map(i => {
                    return {
                        descripcion: i.descripcion,
                        fecha: i.fecha,
                        lineas: i.lineas.map(l => {
                            return {
                                fase: l.fase,
                                producto: l.producto,
                                tarea: l.tarea,
                                qty: l.qty
                            }
                        })
                    }
                })

                console.log('proyecto local', p_to_save)
                await storageProyecto(proyecto)
                alert('Proyecto sincronizado exitosamente')
            } catch (error) {
                console.log('Error', error)
                alert('Error sincronizar poryecto '+error)
            }            
        }

        $scope.sincronizar = async proyecto => {
            console.log('sincronizado poryecto', proyecto)
            alert('sincronizando con el servidor')
        }





        /**
         * Seccion Informes
         */
        $scope.eliminar_informe = removeIndex;

        $scope.nuevo_informe = function () {
            if ($scope.proyecto_actual) {
                $scope.proyecto_actual.informes.push({
                    descripcion: undefined,
                    fecha: new Date(),
                    lineas: []
                })
                console.log('agrego informe', $scope.proyecto_actual)
            } else {
                alert('Seleccione un proyecto')
            }
        }

        $scope.ver_lineas_informe = function (informe) {
            console.log('informe seleccionado', informe)
            $scope.informe_actual = informe
            $('#lineas_informe_proyecto').modal('show')
        }


        /**
         * Seccion lineas informe
         */
        $scope.nueva_linea = function (ubicacion) {
            ubicacion = Number(ubicacion)
            var filter_ubicaciones;

            console.log(ubicacion)
            
            if (ubicacion > 0) {
                filter_ubicaciones = ubicaciones.filter(u => ubicacion === u.tb_proyecto_ubicaciones_id)
            } else {
                filter_ubicaciones = ubicaciones;
            }


            var new_data = {
                proyecto: 'nuevo',
                ubicacion: undefined,
                fase: undefined,
                tarea: undefined,
                producto: undefined,
                qty: undefined, 
                data: { 
                    ubicaciones: filter_ubicaciones, 
                    fases, 
                    tareas, 
                    lineas_tarea 
                }
            }


            $scope.informe_actual.lineas.push(new_data)
        }

        $scope.eliminar_linea = removeIndex

        $scope.cerrar_lineas_informe = function () {
            $('#lineas_informe_proyecto').modal('hide')
        }

        $scope.cambio_ubicacion = function (tb_proyecto_ubicaciones_id, linea) {
            linea.data.fases = fases.filter(f => f.tb_proyecto_ubicaciones_id == tb_proyecto_ubicaciones_id)

            console.log(tb_proyecto_ubicaciones_id, fases)

            if (linea.data.fases.length > 0) {
                linea.fase = linea.data.fases[0].c_projectphase_id
            }
        }

        $scope.cambio_fase = function (c_projectphase_id, linea) {
            linea.data.tareas = tareas.filter(t => t.c_projectphase_id == c_projectphase_id)

            if (linea.data.tareas.length > 0) {
                linea.tarea = linea.data.tareas[0].c_projecttask_id
            }
        }

        $scope.cambio_tarea = function (c_projecttask_id, linea) {
            linea.data.lineas_tarea = lineas_tarea.filter(l => l.c_projecttask_id == c_projecttask_id)

            if (linea.data.lineas_tarea.length > 0) {
                linea.producto = linea.data.lineas_tarea[0].m_product_id
            }
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


        function removeIndex(index, array) {
            array.splice(index, 1)
        }

        $scope.foo = function () {
            console.log('nada...')
        }

    }])
    .controller("proyectos_descargados.avance", ["$scope", "$state", "storage", function($scope, $state, storage){
        $scope.lineas_informe = []
        $scope.informes = []

        $('#crear_avance_modal').modal('show')



        console.log('avances....')


    }])
    .controller("proyectos.cargar", ["$scope", "$state", "storage", function($scope, $state, storage){


        (async function () {
            try {
                var data = await syncProyecto(storage.data)
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
                console.log('Ha ocurrido un error', error)
            } finally {
                $state.go("proyectos")
            }
        })() 

    }])

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

function cargarProyecto (data) {
    EventBus.dispatch('newState', 'proyectos.cargar', leer(data));
}

async function guardarProyecto(proyecto, fase, tarea, comentario, lineas) {

    try {
        proyecto = Number(proyecto)
        fase = Number(fase)
        tarea = Number(tarea)
        comentario = `${comentario ? comentario : ''}`

        lineas = lineas.map(linea => {
            return {
                linea_id: Number(linea.c_line_id),
                plannedamt: Number(linea.plannedamt)
            }
        })

        var response = await fetch(`/proyecto/${proyecto}`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({proyecto, fase, tarea, comentario, lineas})
        })

        if (response.ok) {
            alert("Proyecto actualizado exitosamente")
            console.log(await response.text())
        } else {
            alert("El poryecto no se actualizo de manera correcta")
            console.log(response.status)
            console.log(await response.text())
        }

    } catch (error) {
        console.log("posible error de conexión", error)
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
            codigo: row.codigo,
            m_product_id: Number(row.m_product_id),
            producto: row.producto,
            unidad: row.unidad,
            plannedqty: Number(row.plannedqty),
            plannedprice: Number(row.plannedprice),
            plannedamt: Number(row.plannedamt)
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