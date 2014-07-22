var duplexify = require('duplexify')
var through = require('through2')

var noop = function() {}

var isObject = function(data) {
  return !Buffer.isBuffer(data) && typeof data !== 'string'
}

module.exports = function(onpeek) {
  var buffer = []
  var bufferSize = 0
  var maxBuffer = 65535

  var dup = duplexify.obj()
  var peeker = through.obj({highWaterMark:1}, function(data, enc, cb) {
    if (isObject(data)) return ready(data, null, cb)
    if (!Buffer.isBuffer(data)) data = new Buffer(data)

    var nl = Array.prototype.indexOf.call(data, 10)
    if (nl > 0 && data[nl-1] === 13) nl--

    if (nl > -1) {
      buffer.push(data.slice(0, nl))
      overflow = data.slice(nl)
      return ready(Buffer.concat(buffer), overflow, cb)
    }

    buffer.push(data)
    bufferSize += data.length

    if (bufferSize < maxBuffer) return cb()
    ready(Buffer.concat(buffer), null, cb)
  })

  var onprefinish = function(cb) {
    ready(Buffer.concat(buffer), null, cb)
  }

  var ready = function(data, overflow, cb) {
    dup.removeListener('prefinish', onprefinish)
    onpeek(data, function(err, parser) {
      if (err) return cb(err)
      dup.setWritable(parser)
      dup.setReadable(parser)
      parser.write(data)
      if (overflow) parser.write(overflow)
      data = overflow = buffer = peeker = null // free the data
      cb()
    })
  }

  dup.on('prefinish', onprefinish)
  dup.setWritable(peeker)

  return dup
}