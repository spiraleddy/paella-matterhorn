
function initPaellaMatterhornMe(onSuccess, onError) {

	base.ajax.get({url:'/info/me.json'},
		function(data,contentType,code) {
			paella.matterhorn.me = data;
			if (onSuccess) onSuccess();
		},
		function(data,contentType,code) { if (onError) onError(); }
	);
}

function initPaellaMatterhorn(episodeId, onSuccess, onError) {

	initPaellaMatterhornMe(
		function(){
			base.ajax.get({url:'/search/episode.json', params:{'id': episodeId}},
				function(data,contentType,code) {
					//#DCE auth result check
					var jsonData = data;
					if (typeof (jsonData) == "string") jsonData = JSON.parse(jsonData);
					// test if result is Harvard auth or episode data
					if (!isHarvardDceAuth(jsonData)) {
					   return;
					}
					// #DCE end auth check

					// #DCE verify that results returned at least one episode
					var totalItems = parseInt(data['search-results'].total);
					if (totalItems === 0) {
					   showLoadErrorMessage(paella.dictionary.translate("No recordings found for episode id") + ": \"" + episodeId + "\"");
					   return;
					}

					paella.matterhorn.episode = data['search-results'].result;
					var asyncLoader = new paella.AsyncLoader();
					var offeringId = null;
					var type = null;

					if (paella.matterhorn.episode) {
					   var serie = paella.matterhorn.episode.mediapackage.series;

					   //#DCE logging helper code
					   //TODO: This is assuming we only have one result...
					   var result = data['search-results'].result;
					   if (result != undefined) {
					       if (result.dcIsPartOf != undefined) {
							 offeringId = result.dcIsPartOf.toString();
					       }
					       if (result.dcType != undefined) {
						      type = data['search-results'].result.dcType.toString();
					       }
					   }
					   if (offeringId && type) {
							paella.matterhorn.resourceId = (offeringId.length >= 11 ? "/" + offeringId.substring(0, 4) +
									"/" + offeringId.substring(4, 6) + "/" + offeringId.substring(6,11) + "/" : "") + type;
					   } else {
					       paella.matterhorn.resourceId = "";
					   }
					   // end #DCE logging helper
					   if (serie != undefined) {
						// #DCE get series from Search endpoint
						searchSeriesToSeriesSeries(serie, function(seriesData) {
						    if (!paella.matterhorn.serie)  paella.matterhorn.serie = [];
						    paella.matterhorn.serie[ 'http://purl.org/dc/terms/'] = seriesData;
						});
						if (onSuccess) onSuccess();
					   }
				           else {
						if (onSuccess) onSuccess();
			 		   }
					}
					else {
				 	    if (onError) onError();
					}
				},
				function(data,contentType,code) { if (onError) onError(); }
			);
		},
		function() { if (onError) onError(); }
	);
}

// ------------------------------------------------------------
// #DCE(naomi): start of dce auth addition
var isHarvardDceAuth = function (jsonData) {

    // check that search-results are ok
    var resultsAvailable = (jsonData !== undefined) &&
    (jsonData[ 'search-results'] !== undefined) &&
    (jsonData[ 'search-results'].total !== undefined);

    // if search-results not ok, maybe auth-results?
    if (resultsAvailable === false) {
        var authResultsAvailable = (jsonData !== undefined) &&
        (jsonData[ 'dce-auth-results'] !== undefined) &&
        (jsonData[ 'dce-auth-results'].dceReturnStatus !== undefined);

        // auth-results not present, some other error
        if (authResultsAvailable === false) {
            paella.debug.log("Seach failed, response:  " + data);

            var message = "Cannot access specified video; authorization failed (" + data + ")";
            paella.messageBox.showError(message);
            $(document).trigger(paella.events.error, {
                error: message
            });
            return false;
        }

        // auth-results present, dealing with auth errors
        var authResult = jsonData[ 'dce-auth-results'];
        var returnStatus = authResult.dceReturnStatus;
        if (("401" == returnStatus || "403" == returnStatus) && authResult.dceLocation) {
            window.location.replace(authResult.dceLocation);
        } else {
            paella.messageBox.showError(authResult.dceErrorMessage);
            $(document).trigger(paella.events.error, {
                error: authResult.dceErrorMessage
            });
        }
        return false;
    } else {
        return true;
    }
};
// #DCE(naomi): end of dce auth addition
// ------------------------------------------------------------
// #DCE(karen): START, get search/series and tranform result into series/series format
// This tranforms the series data into the expected upstream series format
var searchSeriesToSeriesSeries = function (serie, onSuccess, onError) {
    base.ajax.get({
        url: '/search/series.json',
        params: {
            'id': serie
        }
    },
    function (data, contentType, code) {
        var jsonData = data;
        try {
            if (typeof (jsonData) == "string") jsonData = JSON.parse(jsonData);
        }
        catch (e) {
            showLoadErrorMessage(paella.dictionary.translate("Unable to parse series id") + "\"" + serie + "\" data: " + data);
            if (typeof (onError) == 'function') {
                onError();
            }
            return;
        }
        // #DCE verify that results returned at least one series
        var totalItems = parseInt(jsonData[ 'search-results'].total);
        if (totalItems === 0) {
            showLoadErrorMessage(paella.dictionary.translate("No series found for series id") + ": \"" + serie + "\"");
            if (typeof (onError) == 'function') {
                onError();
            }
            return;
        } else {
            var dcObject = {};
            var seriesResult = jsonData[ 'search-results'].result;
            for (var key in seriesResult) {
                // trim out "dc" and lower case first letter
                var keyTrimmed = key.replace(/^dc/, '');
                keyTrimmed = keyTrimmed.charAt(0).toLowerCase() + keyTrimmed.slice(1);
                dcObject[keyTrimmed] =[ {
                    "value": seriesResult[key]
                }];
            }
            if (typeof (onSuccess) == 'function') {
                onSuccess(dcObject);
            }
        }
    });
};
// #DCE(karen): END transform series format
// ------------------------------------------------------------
//#DCE show not found error
var showLoadErrorMessage = function (message) {
    paella.messageBox.showError(message);
    $(document).trigger(paella.events.error, {
          error: message
    });
};

paella.matterhorn.InitDelegate = Class.create(paella.InitDelegate,{
	loadConfig:function(onSuccess) {
		var configUrl = this.initParams.configUrl;
		var params = {};
		params.url = configUrl;
		paella.ajax.get(params,function(data, type, returnCode, responseRaw) {
				if (typeof(data)=='string') {
					try {
						data = JSON.parse(data);
					}
					catch (e) {
						onSuccess({});
					}
				}
				onSuccess(data);
			},
			function(data, type,returnCode, responseRaw) {
				if (returnCode == 200){
					if (typeof(responseRaw)=='string') {
						try {
							data = JSON.parse(responseRaw);
						}
						catch (e) {
							data = {};
						}
					}
					onSuccess(data);
				}
				else{
					onSuccess({});
				}
			});
	}
});

function loadPaella(containerId, onSuccess) {
	var initDelegate = new paella.matterhorn.InitDelegate({accessControl:new MHAccessControl(),videoLoader:new MHVideoLoader()});
	var id = paella.utils.parameters.get('id');

	initPaellaMatterhorn(id,
		function() {
			initPaellaEngage(containerId,initDelegate);
			if (onSuccess) onSuccess();
		},
		function() {
			if (paella.matterhorn.me.username == "anonymous") {
				window.location.href = "auth.html?redirect=" + encodeURIComponent(window.location.href);
			}
			else {
				paella.messageBox.showError("Error loading video " + id);
			}		
		}
	);
}

function loadPaellaExtended(containerId, onSuccess) {
	var initDelegate = new paella.matterhorn.InitDelegate({accessControl:new MHAccessControl(),videoLoader:new MHVideoLoader()});
	var id = paella.utils.parameters.get('id');

	initPaellaMatterhorn(id,
		function() {
			initPaellaExtended({containerId:containerId,initDelegate:initDelegate});
			if (onSuccess) onSuccess();
		},
		function() {
			if (paella.matterhorn.me.username == "anonymous") {
				window.location.href = "auth.html?redirect=" + encodeURIComponent(window.location.href);
			}
			else {
				paella.messageBox.showError("Error loading video " + id);
			}		
		}
	);
}

function loadPaellaEditor(containerId) {
    var EditorInitDelegate = Class.create(paella.matterhorn.InitDelegate,{
            loadConfig:function(onSuccess) {
				this.parent(function(data) {
					if (data.editor) {
						data.editor.loadOnStartup = true;
					}
					if (onSuccess) { onSuccess(data); }
				});
            }
    });

	var initDelegate = new EditorInitDelegate({accessControl:new MHAccessControl(),videoLoader:new MHVideoLoader()});
	var id = paella.utils.parameters.get('id');

	initPaellaMatterhorn(id, function() {initPaellaEngage(containerId,initDelegate);});
}