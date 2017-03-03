/**
 * Main App Controller for the Angular Material Starter App
 * @param UsersDataService
 * @param $mdSidenav
 * @constructor
 */
function AppController($http, $scope, $httpParamSerializerJQLike, $mdDialog, $filter, $window) {
    'use strict';
    var self = this;
    self.parcels = [];
    self.fields = [];
    self.vertices = 0;
    self.data = {'Company': null};
    var polyline = null,
      graphic = null,
      gl = null,
      lastPoint = null;
    var map = null,
        featureLayer = null,
        view = null;
    $scope.hideSplash = function () {
        $mdDialog.hide();
    };
    $scope.hideConfirm = function () {
        $mdDialog.hide();
        $window.location.reload();
    };

    self.showSplash = function (ev) {
        $mdDialog.show({
            controller: AppController,
            templateUrl: 'templates/splash.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            clickOutsideToClose: true
        });
    };
    self.showConfirm = function (ev) {
        $mdDialog.show({
            controller: AppController,
            templateUrl: 'templates/confirm.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            clickOutsideToClose: true
        });
    };

    self.submitForm = function () {
        console.log(self.data);
        $http({
            url: "https://services.arcgis.com/v400IkDOw1ad7Yad/arcgis/rest/services/Emergency_Road_Closures/FeatureServer/0/addFeatures",
            method: 'POST',
            data: $httpParamSerializerJQLike({
                f: 'json',
                features: JSON.stringify([{
                    attributes: JSON.parse(angular.toJson(self.data)),
                    geometry: gl.graphics.items[0].geometry//self.selectedAddress.geometry
                }])
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }).then(function (result) {
          console.log(result);
          self.showConfirm();
        });
    };
    self.addressSearch = function (addressText) {
        return $http.get("https://maps.raleighnc.gov/arcgis/rest/services/Addresses/MapServer/0/query?returnGeometry=true&outSR=4326&geometryPrecision=5&f=json&orderByFields=ADDRESS&where=ADDRESSU like '" + addressText.toUpperCase() + "%'")
            .then(function (result) {
                return result.data.features;
            });
    };

    self.addAddressToMap = function (address) {
        if (address) {
            require(["esri/Graphic", "esri/geometry/Point", "esri/symbols/SimpleMarkerSymbol"], function (Graphic, Point, SimpleMarkerSymbol) {
                var markerSymbol = new SimpleMarkerSymbol({
                    color: [226, 119, 40],
                    outline: {
                        color: [255, 255, 255],
                        width: 2
                    }
                });
                var pointGraphic = new Graphic({
                    geometry: new Point({
                        longitude: address.geometry.x,
                        latitude: address.geometry.y
                    }),
                    attributes: address.attributes
                });
                pointGraphic.symbol = markerSymbol;
                view.graphics.removeAll();
                view.graphics.add(pointGraphic);
                self.selectProperty(new Point({
                    longitude: address.geometry.x,
                    latitude: address.geometry.y,
                    spatialReference: view.spatialReference
                }), "https://maps.raleighnc.gov/arcgis/rest/services/Parcels/MapServer");
            });
        }
    };
    self.addressSelected = function (address) {
        if (address) {
            view.goTo({
                center: [address.geometry.x, address.geometry.y],
                zoom: 17
            });
            //self.data.address = self.selectedAddress.attributes.ADDRESS;
            self.addAddressToMap(address);
        }
    };
    var findStreet = function (point) {
      require([
          "esri/tasks/QueryTask",
          "esri/tasks/support/Query",
          "esri/geometry/geometryEngine"
      ], function (QueryTask, Query, geometryEngine, Polyline) {
        var queryTask = new QueryTask("https://maps.raleighnc.gov/arcgis/rest/services/BaseMapBasic/MapServer/7")
        var query = new Query();
        query.geometry = point.mapPoint;
        query.distance = 40;
        query.units = 'feet';
        query.spatialRelationship = 'intersects';
        query.returnGeometry = true;
        queryTask.execute(query).then(function (result) {
          console.log(result);
          if (result.features.length > 0) {
            var street = result.features[0];
            var coord = geometryEngine.nearestCoordinate(result.features[0].geometry, point.mapPoint);
            console.log(coord);
            if (polyline.paths.length === 0) {
              polyline.addPath([coord.coordinate])
            } else {
              polyline.insertPoint(0, polyline.paths[0].length, coord.coordinate);
            }
            self.vertices += 1;
            $scope.$apply();
            var newg = graphic.clone();
            newg.geometry = polyline;
            gl.removeAll();
            gl.add(newg);
            lastPoint = coord.coordinate;
          }
        });
      });
    }

    self.createMap = function () {
        require([
            "esri/Map",
            "esri/views/MapView",
            "esri/layers/MapImageLayer",
            "esri/layers/GraphicsLayer",
            "esri/layers/FeatureLayer",
            "esri/geometry/Polyline",
            "esri/Graphic",
            "esri/symbols/SimpleLineSymbol",
            "esri/widgets/Search",
            "dojo/domReady!"
        ], function (Map, MapView, MapImageLayer, GraphicsLayer, FeatureLayer, Polyline, Graphic, SimpleLineSymbol, Search) {
            if (!map) {
                map = new Map({basemap: "streets-navigation-vector"});
                view = new MapView({
                    container: "viewDiv",
                    map: map,
                    center: [-78.65, 35.8],
                    zoom: 15
                });
                var searchWidget = new Search({
                  view: view
                });
                // Adds the search widget below other elements in
                // the top left corner of the view
                view.ui.add(searchWidget, {
                  position: "top-right",
                  index: 2
                });

                featureLayer = new FeatureLayer("https://services.arcgis.com/v400IkDOw1ad7Yad/arcgis/rest/services/Emergency_Road_Closures/FeatureServer/0");

                map.add(featureLayer);


                featureLayer.on('layerview-create', function (event) {
                  self.fields = event.layerView.layer.fields;
                  $scope.$apply();
                  featureLayer.visible = false;
                });
                polyline = new Polyline();
                polyline.spatialReference = { wkid: 3857 }
                gl = new GraphicsLayer();
                graphic = new Graphic();
                graphic.geometry = polyline;
                var symbol = new SimpleLineSymbol({
                  color: "red",
                  width: "10px",
                  style: "solid"
                });
                graphic.symbol = symbol;
                gl.add(graphic);
                map.add(gl);
                view.on('click', function (point) {
                    // if (view.zoom >= 15) {
                    //     self.selectProperty(point.mapPoint, "https://maps.raleighnc.gov/arcgis/rest/services/Parcels/MapServer");
                    // }
                    findStreet(point);
                });
            }
        });
    };
}
export default ['$http', '$scope', '$httpParamSerializerJQLike', '$mdDialog', '$filter', '$window', AppController];
