Logger = require './logger'
CLI = require './cli'
Config = require './config'
WebServer = require './webserver'

###*
 * The base application class.
###
class Application
  constructor: ->
    @config = Config.get()
    @logger = Logger.get()
    @cli = new CLI()
    @ws = new WebServer()

  ###*
   * Aborts the application with a message.
   * @param {String} (msg) The message to abort the application with
  ###
  abort: (msg) =>
    @logger.info(''.concat('Aborting Application: ', str, '...'))
    process.exit(1)

module.exports = Application
