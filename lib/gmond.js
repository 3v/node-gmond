// Generated by CoffeeScript 1.4.0
(function() {
  var CLI, Config, Gmetric, Gmond, Logger, WebServer, async, builder, dgram, net,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  net = require('net');

  dgram = require('dgram');

  Gmetric = require('gmetric');

  builder = require('xmlbuilder');

  async = require('async');

  Logger = require('./logger');

  CLI = require('./cli');

  Config = require('./config');

  WebServer = require('./webserver');

  /**
   * The ganglia gmond class.
  */


  Gmond = (function() {

    function Gmond() {
      this.generate_cluster_element = __bind(this.generate_cluster_element, this);
      this.generate_ganglia_xml = __bind(this.generate_ganglia_xml, this);
      this.generate_xml_snapshot = __bind(this.generate_xml_snapshot, this);
      this.determine_cluster_from_metric = __bind(this.determine_cluster_from_metric, this);
      this.merge_metric = __bind(this.merge_metric, this);
      this.set_metric_timer = __bind(this.set_metric_timer, this);
      this.set_host_timer = __bind(this.set_host_timer, this);
      this.add_metric = __bind(this.add_metric, this);
      this.stop_timers = __bind(this.stop_timers, this);
      this.stop_services = __bind(this.stop_services, this);
      this.stop_xml_service = __bind(this.stop_xml_service, this);
      this.start_xml_service = __bind(this.start_xml_service, this);
      this.stop_udp_service = __bind(this.stop_udp_service, this);
      this.start_udp_service = __bind(this.start_udp_service, this);      this.config = Config.get();
      this.logger = Logger.get();
      this.gmetric = new Gmetric();
      this.socket = dgram.createSocket('udp4');
      this.gmond_started = this.unix_time();
      this.host_timers = new Object();
      this.metric_timers = new Object();
      this.hosts = new Object();
      this.clusters = new Object();
      this.udp_server = null;
      this.xml_server = null;
      this.start_udp_service();
      this.start_xml_service();
    }

    /**
     * Starts the udp gmond service.
    */


    Gmond.prototype.start_udp_service = function() {
      var _this = this;
      this.socket.on('message', function(msg, rinfo) {
        return _this.add_metric(msg);
      });
      return this.socket.bind(this.config.get('gmond_udp_port'));
    };

    /**
     * Stops the udp gmond service.
    */


    Gmond.prototype.stop_udp_service = function() {
      return this.socket.close();
    };

    /**
     * Starts up the xml service.
    */


    Gmond.prototype.start_xml_service = function() {
      var _this = this;
      this.xml_server = net.createServer(function(sock) {
        return sock.end(_this.generate_xml_snapshot());
      });
      return this.xml_server.listen(this.config.get('gmond_tcp_port'), this.config.get('listen_address'));
    };

    /**
     * Stops the xml service.
     * @param {Function} (fn) The callback function
    */


    Gmond.prototype.stop_xml_service = function(fn) {
      return this.xml_server.close(fn);
    };

    /**
     * Stops all external services.
     * @param {Function} (fn) The callback function
    */


    Gmond.prototype.stop_services = function(fn) {
      this.stop_udp_service();
      return this.stop_xml_service(fn);
    };

    /**
     * Stop all timers.
    */


    Gmond.prototype.stop_timers = function(fn) {
      var ht, htimers, mt, mtimers, _i, _j, _len, _len1;
      htimers = Object.keys(this.host_timers);
      mtimers = Object.keys(this.metric_timers);
      for (_i = 0, _len = htimers.length; _i < _len; _i++) {
        ht = htimers[_i];
        clearInterval(this.host_timers[ht]);
        delete this.host_timers[ht];
      }
      for (_j = 0, _len1 = mtimers.length; _j < _len1; _j++) {
        mt = mtimers[_j];
        clearInterval(this.metric_timers[mt]);
        delete this.metric_timers[mt];
      }
      return fn();
    };

    /**
     * Returns the current unix timestamp.
     * @return {Integer} The unix timestamp integer
    */


    Gmond.prototype.unix_time = function() {
      return Math.floor(new Date().getTime() / 1000);
    };

    /**
     * Adds a new metric automatically determining the cluster or using defaults.
     * @param {Object} (metric) The raw metric packet to add
    */


    Gmond.prototype.add_metric = function(metric) {
      var cluster, hmet, msg_type, _base, _base1, _base2, _base3, _name;
      msg_type = metric.readInt32BE(0);
      if ((msg_type === 128) || (msg_type === 133)) {
        hmet = this.gmetric.unpack(metric);
        (_base = this.hosts)[_name = hmet.hostname] || (_base[_name] = new Object());
        if (msg_type === 128) {
          cluster = this.determine_cluster_from_metric(hmet);
          (_base1 = this.hosts[hmet.hostname]).cluster || (_base1.cluster = cluster);
          (_base2 = this.clusters)[cluster] || (_base2[cluster] = new Object());
          (_base3 = this.clusters[cluster]).hosts || (_base3.hosts = new Object());
          this.clusters[cluster].hosts[hmet.hostname] = true;
        }
        this.set_metric_timer(hmet);
        this.set_host_timer(hmet);
        return this.merge_metric(this.hosts[hmet.hostname], hmet);
      }
    };

    /**
     * Sets up the host DMAX timer for host cleanup.
     * @param {Object} (hmetric) The host metric information
    */


    Gmond.prototype.set_host_timer = function(hmetric) {
      var _base, _name,
        _this = this;
      return (_base = this.host_timers)[_name = hmetric.hostname] || (_base[_name] = setInterval(function() {
        var cluster, timeout, tn;
        try {
          timeout = _this.hosts[hmetric.hostname].dmax || _this.config.get('dmax');
          tn = _this.unix_time() - _this.hosts[hmetric.hostname]['host_reported'];
          if (tn > timeout) {
            cluster = hmetric.cluster;
            delete _this.hosts[hmetric.hostname];
            if (_this.clusters[cluster] && _this.clusters[cluster].hasOwnProperty('hosts')) {
              delete _this.clusters[cluster].hosts[hmetric.hostname];
            }
            clearInterval(_this.host_timers[hmetric.hostname]);
            return delete _this.host_timers[hmetric.hostname];
          }
        } catch (e) {
          return null;
        }
      }, this.config.get('cleanup_threshold')));
    };

    /**
     * Sets up the metric DMAX timer for metric cleanup.
     * @param {Object} (hmetric) The host metric information
    */


    Gmond.prototype.set_metric_timer = function(hmetric) {
      var metric_key, _base,
        _this = this;
      metric_key = [hmetric.hostname, hmetric.name].join('|');
      return (_base = this.metric_timers)[metric_key] || (_base[metric_key] = setInterval(function() {
        var timeout, tn;
        try {
          timeout = hmetric.dmax || _this.config.get('dmax');
          tn = _this.unix_time() - _this.hosts[hmetric.hostname]['reported'][hmetric.name];
          if (tn > timeout) {
            if (_this.hosts[gmetric.hostname] && _this.hosts[hmetric.hostname]['metrics']) {
              delete _this.hosts[hmetric.hostname]['metrics'][hmetric.name];
            }
            clearInterval(_this.metric_timers[metric_key]);
            return delete _this.metric_timers[metric_key];
          }
        } catch (e) {
          return null;
        }
      }, this.config.get('cleanup_threshold')));
    };

    /**
     * Merges a metric with the hosts object.
     * @param {Object} (target) The target hosts object to modify
     * @param {Object} (hgmetric) The host information to merge
    */


    Gmond.prototype.merge_metric = function(target, hmetric) {
      var key, now, _base, _i, _len, _name, _ref;
      now = this.unix_time();
      target['host_reported'] = now;
      target['reported'] || (target['reported'] = new Object());
      target['tags'] || (target['tags'] = new Array());
      target['ip'] || (target['ip'] = hmetric.hostname);
      target['metrics'] || (target['metrics'] = new Object());
      (_base = target['metrics'])[_name = hmetric.name] || (_base[_name] = new Object());
      _ref = Object.keys(hmetric);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        key = _ref[_i];
        target['metrics'][hmetric.name][key] = hmetric[key];
      }
      return target['reported'][hmetric.name] = now;
    };

    /**
     * Returns the cluster of the metric or assumes the default.
     * @param  {Object} (hgmetric) The host information to merge
     * @return {String} The name of the cluster for the metric
    */


    Gmond.prototype.determine_cluster_from_metric = function(hmetric) {
      var cluster;
      cluster = hmetric['cluster'] || this.config.get('cluster');
      delete hmetric['cluster'];
      return cluster;
    };

    /**
     * Generates an xml snapshot of the gmond state.
     * @return {String} The ganglia xml snapshot pretty-printed
    */


    Gmond.prototype.generate_xml_snapshot = function() {
      return this.generate_ganglia_xml().end({
        pretty: true,
        indent: '  ',
        newline: "\n"
      });
    };

    /**
     * Generates the xml builder for a ganglia xml view.
     * @return {Object} The root node of the full ganglia xml view
    */


    Gmond.prototype.generate_ganglia_xml = function() {
      var cluster, root, _i, _len, _ref;
      root = this.get_gmond_xml_root();
      _ref = Object.keys(this.clusters);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        cluster = _ref[_i];
        root = this.generate_cluster_element(root, cluster);
      }
      return root;
    };

    /**
     * Appends the cluster_xml for a single cluster to the a given node.
     * @param  {Object} (root) The root node to create the cluster element on
     * @param  {String} (cluster) The cluster to generate elements for
     * @return {Object} The root node with the newly attached cluster
    */


    Gmond.prototype.generate_cluster_element = function(root, cluster) {
      var ce, h, hostlist, _i, _len;
      if (Object.keys(this.clusters[cluster].hosts).length === 0) {
        delete_cluster(cluster);
      }
      ce = root.ele('CLUSTER');
      ce.att('NAME', cluster || this.config.get('cluster'));
      ce.att('LOCALTIME', this.unix_time());
      ce.att('OWNER', this.clusters[cluster].owner || this.config.get('owner'));
      ce.att('LATLONG', this.clusters[cluster].latlong || this.config.get('latlong'));
      ce.att('URL', this.clusters[cluster].url || this.config.get('url'));
      if (this.clusters[cluster] === void 0) {
        return root;
      }
      hostlist = Object.keys(this.clusters[cluster].hosts);
      if (hostlist.length === 0) {
        return root;
      }
      for (_i = 0, _len = hostlist.length; _i < _len; _i++) {
        h = hostlist[_i];
        ce = this.generate_host_element(ce, this.hosts[h], h);
      }
      return root;
    };

    /**
     * Generates a host element for a given host and attaches to the parent.
     * @param  {Object} (parent)   The parent node to append the host elem to
     * @param  {Object} (hostinfo) The host information for the given host
     * @param  {String} (hostname) The hostname of the current host
     * @return {Object} The parent node with host elements attached
    */


    Gmond.prototype.generate_host_element = function(parent, hostinfo, hostname) {
      var he, m, _i, _len, _ref;
      he = parent.ele('HOST');
      he.att('NAME', hostname);
      he.att('IP', hostinfo['ip']);
      he.att('TAGS', (hostinfo['tags'] || []).join(','));
      he.att('REPORTED', hostinfo['host_reported']);
      he.att('TN', this.unix_time() - hostinfo['host_reported']);
      he.att('TMAX', hostinfo.tmax || this.config.get('tmax'));
      he.att('DMAX', hostinfo.dmax || this.config.get('dmax'));
      he.att('LOCATION', hostinfo.location || this.config.get('latlong'));
      he.att('GMOND_STARTED', 0);
      _ref = Object.keys(hostinfo.metrics);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        m = _ref[_i];
        he = this.generate_metric_element(he, hostinfo, hostinfo.metrics[m]);
      }
      return parent;
    };

    /**
     * Generates the metric element and attaches to the parent.
     * @param  {Object} (parent) The parent node to append the metric elem to
     * @param  {Object} (host)   The host information for the given metric
     * @param  {Object} (metric) The metric to generate metric xml from
     * @return {Object} The parent node with metric elements attached
    */


    Gmond.prototype.generate_metric_element = function(parent, hostinfo, metric) {
      var me;
      me = parent.ele('METRIC');
      me.att('NAME', metric.name);
      me.att('VAL', metric.value);
      me.att('TYPE', metric.type);
      me.att('UNITS', metric.units);
      me.att('TN', this.unix_time() - hostinfo['reported'][metric.name]);
      me.att('TMAX', metric.tmax || this.config.get('tmax'));
      me.att('DMAX', metric.dmax || this.config.get('dmax'));
      me.att('SLOPE', metric.slope);
      me = this.generate_extra_elements(me, metric);
      return parent;
    };

    /**
     * Generates the extra elems for a metric and attaches to the parent.
     * @param  {Object} (parent) The parent node to append the extra data to
     * @param  {Object} (metric) The metric to generate extra_elements from
     * @return {Object} The parent node with extra elements attached
    */


    Gmond.prototype.generate_extra_elements = function(parent, metric) {
      var ed, ee, extra, extras, _i, _len;
      extras = this.gmetric.extra_elements(metric);
      if (extras.length < 1) {
        return parent;
      }
      ed = parent.ele('EXTRA_DATA');
      for (_i = 0, _len = extras.length; _i < _len; _i++) {
        extra = extras[_i];
        ee = ed.ele('EXTRA_ELEMENT');
        ee.att('NAME', extra.toUpperCase());
        ee.att('VAL', metric[extra]);
      }
      return parent;
    };

    /**
     * Returns the gmond_xml root node to build upon.
     * @return {Object} The root gmond xmlbuilder
    */


    Gmond.prototype.get_gmond_xml_root = function() {
      var root;
      root = builder.create('GANGLIA_XML', {
        version: '1.0',
        encoding: 'ISO-8859-1',
        standalone: 'yes'
      }, {
        ext: "[\n<!ELEMENT GANGLIA_XML (GRID|CLUSTER|HOST)*>\n   <!ATTLIST GANGLIA_XML VERSION CDATA #REQUIRED>\n   <!ATTLIST GANGLIA_XML SOURCE CDATA #REQUIRED>\n<!ELEMENT GRID (CLUSTER | GRID | HOSTS | METRICS)*>\n   <!ATTLIST GRID NAME CDATA #REQUIRED>\n   <!ATTLIST GRID AUTHORITY CDATA #REQUIRED>\n   <!ATTLIST GRID LOCALTIME CDATA #IMPLIED>\n<!ELEMENT CLUSTER (HOST | HOSTS | METRICS)*>\n   <!ATTLIST CLUSTER NAME CDATA #REQUIRED>\n   <!ATTLIST CLUSTER OWNER CDATA #IMPLIED>\n   <!ATTLIST CLUSTER LATLONG CDATA #IMPLIED>\n   <!ATTLIST CLUSTER URL CDATA #IMPLIED>\n   <!ATTLIST CLUSTER LOCALTIME CDATA #REQUIRED>\n<!ELEMENT HOST (METRIC)*>\n   <!ATTLIST HOST NAME CDATA #REQUIRED>\n   <!ATTLIST HOST IP CDATA #REQUIRED>\n   <!ATTLIST HOST LOCATION CDATA #IMPLIED>\n   <!ATTLIST HOST TAGS CDATA #IMPLIED>\n   <!ATTLIST HOST REPORTED CDATA #REQUIRED>\n   <!ATTLIST HOST TN CDATA #IMPLIED>\n   <!ATTLIST HOST TMAX CDATA #IMPLIED>\n   <!ATTLIST HOST DMAX CDATA #IMPLIED>\n   <!ATTLIST HOST GMOND_STARTED CDATA #IMPLIED>\n<!ELEMENT METRIC (EXTRA_DATA*)>\n   <!ATTLIST METRIC NAME CDATA #REQUIRED>\n   <!ATTLIST METRIC VAL CDATA #REQUIRED>\n   <!ATTLIST METRIC TYPE (string | int8 | uint8 | int16 | uint16 | int32 | uint32 | int64 | uint64 | float | double | timestamp) #REQUIRED>\n   <!ATTLIST METRIC UNITS CDATA #IMPLIED>\n   <!ATTLIST METRIC TN CDATA #IMPLIED>\n   <!ATTLIST METRIC TMAX CDATA #IMPLIED>\n   <!ATTLIST METRIC DMAX CDATA #IMPLIED>\n   <!ATTLIST METRIC SLOPE (zero | positive | negative | both | unspecified) #IMPLIED>\n   <!ATTLIST METRIC SOURCE (gmond) 'gmond'>\n<!ELEMENT EXTRA_DATA (EXTRA_ELEMENT*)>\n<!ELEMENT EXTRA_ELEMENT EMPTY>\n   <!ATTLIST EXTRA_ELEMENT NAME CDATA #REQUIRED>\n   <!ATTLIST EXTRA_ELEMENT VAL CDATA #REQUIRED>\n<!ELEMENT HOSTS EMPTY>\n   <!ATTLIST HOSTS UP CDATA #REQUIRED>\n   <!ATTLIST HOSTS DOWN CDATA #REQUIRED>\n   <!ATTLIST HOSTS SOURCE (gmond | gmetad) #REQUIRED>\n<!ELEMENT METRICS (EXTRA_DATA*)>\n   <!ATTLIST METRICS NAME CDATA #REQUIRED>\n   <!ATTLIST METRICS SUM CDATA #REQUIRED>\n   <!ATTLIST METRICS NUM CDATA #REQUIRED>\n   <!ATTLIST METRICS TYPE (string | int8 | uint8 | int16 | uint16 | int32 | uint32 | int64| uint64 | float | double | timestamp) #REQUIRED>\n   <!ATTLIST METRICS UNITS CDATA #IMPLIED>\n   <!ATTLIST METRICS SLOPE (zero | positive | negative | both | unspecified) #IMPLIED>\n   <!ATTLIST METRICS SOURCE (gmond) 'gmond'>\n]"
      });
      root.att('VERSION', '3.5.0');
      root.att('SOURCE', 'gmond');
      return root;
    };

    return Gmond;

  })();

  module.exports = Gmond;

}).call(this);
