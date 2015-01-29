var map;
var infowindow;
var mapOptions = {
  zoom: 13,
  disableDefaultUI: true,
  scaleControl: true
};
//Model for very venue retrieved from foursquare
VenueModel = function(data) {
  this.name = this.validate(data.venue.name);
  this.contact = this.validate(data.venue.contact.formattedPhone);
  this.address = this.validate(data.venue.location.formattedAddress[0]);
  this.category = this.validate(data.venue.categories[0].name);
  this.verified = this.validate(data.venue.verified);
  this.rating = this.validate(data.venue.rating);
  this.icon_prefix = data.venue.categories[0].icon.prefix;
  this.icon_suffix = data.venue.categories[0].icon.suffix;
  //set a marker for a venue
  this.marker = new google.maps.Marker({
    position: new google.maps.LatLng(
    data.venue.location.lat,
    data.venue.location.lng
    ),
    icon: this.icon_prefix + "bg_44" + this.icon_suffix,
    animation: google.maps.Animation.DROP
  });
  //get an image from flickr for this venue
  var that = this;
  that.HTMLimage = ko.observable();
  var flickrUrl = 'http://api.flickr.com/services/feeds/photos_public.gne?format=json&tags=@@searchstring@@&jsoncallback=?';
  var flickr = $.ajax({
    tags: that.name,
    url: flickrUrl.replace('@@searchstring@@', that.name),
    dataType: "jsonp",
    timeout: 20000
  });
  //console.log( 'flickrUrl ' + flickrUrl.replace( '@@searchstring@@' , that.name ) );
  flickr.error(function () {
    that.HTMLimage('http://nancyharmonjenkins.com/wp-content/plugins/nertworks-all-in-one-social-share-tools/images/no_image.png');
  });
  flickr.success(function (data) {
    var images = data.items;
    if (images.length > 0) {
      //get a random image
      var image = images[Math.floor(Math.random() * images.length)];
      var imageUrl = image.media.m;
      that.HTMLimage(imageUrl);
    }
    else {
      that.HTMLimage('http://nancyharmonjenkins.com/wp-content/plugins/nertworks-all-in-one-social-share-tools/images/no_image.png');
    }
  });
  this.HTMLimage = that.HTMLimage;
  //console.log( 'this.HTMLimage ' + this.HTMLimage );
};

//Add a marker to the map
VenueModel.prototype.addMarker = function() {
  this.marker.setMap(map);
};

//Remove a marker from the map
VenueModel.prototype.removeMarker = function() {
  this.marker.setMap(null);
};

//Open infomation window
VenueModel.prototype.openInfoWindow = function() {
  infowindow.setContent(this.marker.contentHtml);
  infowindow.open(map, this.marker);
  resetMap();
};

//Extend bounds for the venue model
VenueModel.prototype.extendBounds = function(bounds) {
  bounds.extend(this.marker.getPosition());
};

//Check there is a valid value for each property of the venue model
VenueModel.prototype.validate = function(raw_data) {
  if(!raw_data) {
    return "N/A";
  }
  else {
    return raw_data;
  }

};

//Model for all the venues, which is a array of venue models
function VenuesModel() {
  var self = this;

  //ObservableArray to store all VenueModel
  self.venuesModel = ko.observableArray();
  //Observable for number of models unread
  self.num_unread = ko.observable(0);
  //Observable to store boolean variable for if the list of models is shown or not
  self.if_shown = ko.observable(false);


  //request popular venue models from FOURSQAURE
  self.addvenuesModel = function() {
    //set limit 10 for number of venue models
    var four_square_baseUrl = "https://api.foursquare.com/v2/venues/explore?client_id=2XMLIEZFYZSTKFVOSAL5JQFQLQNDNMYGXWGGPWXUSDXQCK4L&client_secret=ZKSE15LDLRYU31YZA2WRL2UYQLDGWFBIPUPTLRH3ITWCEZFL&v=20141230&radius=15000&limit=10&";
    //get current map center when request
    var ll = map.getCenter().toUrlValue();
    //get query from input when request
    var query = $("#search_by").val();
    var urlToRequest = four_square_baseUrl + "ll=" + ll + "&query=" + query;
    //make ajax call
    $.getJSON(urlToRequest, function(data) {
      var venues = data.response.groups[0].items;
      var bounds = new google.maps.LatLngBounds();
      if(self.checkError(venues) === false)
        return;
      for(var index in venues) {
        var venueModel = new VenueModel(venues[index]);
        venueModel.extendBounds(bounds);
        venueModel.addMarker();
        //get information window content for every venue model
        ko.applyBindings(venueModel, $('#infoWindow')[0]);
        venueModel.marker.contentHtml = $('#infoWindow').html()
        //console.log( 'venueModel.marker.contentHtml ' + venueModel.marker.contentHtml );
        //remove the binding
        ko.cleanNode($('#infoWindow')[0]);
        self.venuesModel.push(venueModel);
        //add click event listener for every marker
        google.maps.event.addListener(venueModel.marker, 'click', function() {
          infowindow.setContent(this.contentHtml);
          infowindow.open(map, this);
          resetMap(this.getPosition());
        });
      }

      map.fitBounds(bounds);
      map.setCenter(bounds.getCenter());
    //not show the list if the ajax call fails
    }).error(function() {
      self.if_shown(false);
    })
  };

  //Remove all venue models from the array and remove their markers from the map
  self.removevenuesModel = function() {
    while(self.venuesModel().length > 0) {
      self.venuesModel.pop().removeMarker();
    }
  };

  //Update the array of venue models if search button is clicked
  self.updatevenuesModel = function() {
    if(self.venuesModel().length > 0) {
      self.removevenuesModel();
    }

    self.addvenuesModel();
  };

  //Update the number of venue models unread
  self.updatenum_unread = function() {
    self.num_unread(0);
  };

  //Check if there are errors from the response from foursquare
  self.checkError = function(data) {
    if(data.length < 1) {
      self.num_unread(0);
      self.if_shown(false);
      return false;
    }
    else {
      self.num_unread(data.length);
      self.if_shown(true);
      return true;
    }
  };

}

function resetMap(position) {
  map.setCenter(position);
  //set zoom level to 13 when the current zoom level is less than 13
  if(map.getZoom() < mapOptions.zoom) {
    map.setZoom(mapOptions.zoom);
  }
}

//Initialize the map
function initialize() {

  map = new google.maps.Map($('#map-canvas')[0], mapOptions);

  // Try W3C Geolocation (Preferred)
  //Autodetect user location
  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      console.log("*********** l " + position.coords.latitude);
      console.log("********* long " + position.coords.longitude);
      var initialLocation = new google.maps.LatLng(
        position.coords.latitude,
        position.coords.longitude
        );
      map.setCenter(initialLocation);
    }, function() {
      //default Palo Alto, CA
      map.setCenter(new google.maps.LatLng(37.41854,-122.103674));
    });
  }
  // Browser doesn't support Geolocation
  else {
    map.setCenter(new google.maps.LatLng(37.41854,-122.103674));
  }

  //Resize handler
  google.maps.event.addDomListener(window, "Resize", function() {
    var center = map.getCenter();
    google.maps.event.trigger(map, "resize");
    map.setCenter(center);
  });

  infowindow = new google.maps.InfoWindow({content: ""});

  ko.applyBindings(new VenuesModel(), $('#full-screen')[0]);
  //Bootstrap popover

  //Bootstrap popover event handler
    var myLocation = $('#myAdress_input')[0];

    //Google map autocomplete
    var autocompleteOption = {
      types: ['geocode']
    };
    var autocomplete = new google.maps.places.Autocomplete(
      myLocation,
      autocompleteOption
    );
    //Google map autocomplete event handler
    google.maps.event.addListener(autocomplete, 'place_changed', function() {
      var place = autocomplete.getPlace();
      //No geometry
      if(!place.geometry) {
        return;
      }
      //Have geometry
      //If have viewport
      if(place.geometry.viewport) {
        map.fitBounds(place.geometry.viewport);
      //If have no viewport
      }
      else {
        resetMap( place.geometry.location );
      }

    });

}

//Do initializa function each time when window is load
google.maps.event.addDomListener(window, 'load', initialize);
