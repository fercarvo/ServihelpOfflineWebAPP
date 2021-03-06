/**
 * Service worker para ITSC
 * 
 * 15/10/2018
 * Edgar Carvajal efcu03@gmail.com
 * 
 * Este SW servira para incrementar el performance y reducir el trafico de los aplicativos usados en ITSC
 */

const CACHE_NAME = 'ITSC-Servihelp-v1.8-pruebas'

const static = [
    '/js/app.js',
    '/',
    '/login/'
]

self.addEventListener('install', function (event) {
    self.skipWaiting();

    event.waitUntil(async function() {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(static)
    }())
})

self.addEventListener('activate', function(event) {

    event.waitUntil(async function () {
        var cacheNames = await caches.keys() //Todos los cache
        var toRemove = cacheNames.filter(c => c !== CACHE_NAME) //Se filtra todos los diferentes a CACHE_NAME
        console.log('[SW] Removiendo caches', toRemove)

        return await Promise.all(toRemove.map(c => caches.delete(c)))
    }())    
})

self.addEventListener('fetch', function(event) {

    const destination = event.request.destination;

    //El login es siempre network, pero se almacena en cache para logearse en modo offline
    if (event.request.method == 'GET' && (RegExp( '/login/data' ).test( event.request.url ) || RegExp( '/login/rol/data' ).test( event.request.url ))) {
        event.respondWith( networkThenCache(event) )
        return;
    }

    if (event.request.method != 'GET')
        return;

    if (RegExp('/app.js').test( event.request.url ))
        return event.respondWith( cacheThenNetworkUpdate(event) )

    if (RegExp('/views/').test( event.request.url ))
        return event.respondWith( alwaysCache(event) );    

    if (RegExp( '/logout/' ).test( event.request.url ))
        return;

    switch (destination) {
        case 'style':
        case 'script':
        case 'image':
        case 'font': {
            event.respondWith( alwaysCache(event) )
            return;
        }
        default: {
            event.respondWith( cacheThenNetworkUpdate(event) )  
            return;
        }
    }
})

/**
 * Retorna el Request del cache, luego actualiza el Response para el siguiente fetch
 * @param {*} event 
 */
async function cacheThenNetworkUpdate(event) {
    var cache = await caches.open(CACHE_NAME)
    var cacheResponse = await cache.match(event.request, {ignoreSearch: false})
    var requestToCache = event.request.clone()

    var fetchPromise = fetch(event.request, { redirect: 'follow' }).then(networkResponse => {
        
        //Si hay respuesta, pero no es 200 ok, se retorna y no se cachea
        if (networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
        }

        let responseToCache = networkResponse.clone()
        cache.put(requestToCache, responseToCache)
        console.log('[SW] Guardado en cache', event.request.url)

        return networkResponse;
    })

    return cacheResponse || fetchPromise
}

async function alwaysCache (event) {
    var response = await caches.match(event.request, {ignoreSearch: false, cacheName: CACHE_NAME})

    return response || fetch(event.request, { redirect: 'follow' }).then(networkResponse => {
        
        //Si hay respuesta, pero no es 200 ok, se retorna y no se cachea
        if (networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
        }
        
        let responseToCache = networkResponse.clone()
        caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache)
            console.log('[SW] Guardado en cache', event.request.url)
        })

        return networkResponse;
    })
}

async function networkThenCache(event) {
    var requestToCache = event.request.clone()
    try {
        var response = await fetch(event.request)

        //Si hay respuesta, pero no es 200 ok, se retorna y no se cachea
        if (response.status !== 200 || response.type !== 'basic') {
            return response;
        }

        var responseToCache = response.clone();

        caches.open(CACHE_NAME).then(cache => {
            cache.put(requestToCache, responseToCache)
            console.log('[SW] Guardado en cache', event.request.url)
        })

        return response

    } catch (error) {
        var response_cache = await caches.match(event.request, {cacheName: CACHE_NAME})
        return response_cache
    }
}