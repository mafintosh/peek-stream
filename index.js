var duplexify = require('duplexify')
var through = require('through2')

var noop = function() {}

var isObject = function(data) {
  return !Buffer.isBuffer(data) && typeof data !== 'string'
}

var peek = function(maxBuffer, onpeek) {
  if (typeof maxBuffer === 'function') return peek(65535, maxBuffer)

  var buffer = []
  var bufferSize = 0
  var dup = duplexify.obj()

  var peeker = through.obj({highWaterMark:1}, function(data, enc, cb) {
    if (isObject(data)) return ready(data, null, cb)
    if (!Buffer.isBuffer(data)) data = new Buffer(data)

    var nl = Array.prototype.indexOf.call(data, 10)
    if (nl > 0 && data[nl-1] === 13) nl--

    if (nl > -1) {
      buffer.push(data.slice(0, nl))
      return ready(Buffer.concat(buffer), data.slice(nl), cb)
    }

    buffer.push(data)
    bufferSize += data.length

    if (bufferSize < maxBuffer) return cb()
    ready(Buffer.concat(buffer), null, cb)
  })

  var onpreend = function() {
    dup.cork()
    ready(Buffer.concat(buffer), null, function(err) {
      if (err) return dup.destroy(err)
      dup.uncork()
    })
  }

  var ready = function(data, overflow, cb) {
    dup.removeListener('preend', onpreend)
    onpeek(data, function(err, parser) {
      if (err) return cb(err)

      dup.setWritable(parser)
      dup.setReadable(parser)

      if (data) parser.write(data)
      if (overflow) parser.write(overflow)

      overflow = buffer = peeker = null // free the data
      cb()
    })
  }

  dup.on('preend', onpreend)
  dup.setWritable(peeker)

  return dup
}

module.exports = peek