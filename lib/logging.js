const bsyslog = require('bunyan-syslog-udp')

module.exports = app => {
  const syslogHost = process.env.SYSLOG_UDP_HOST
  const syslogPort = parseInt(process.env.SYSLOG_UDP_PORT, 10)
  if (syslogHost && syslogPort) {
    app.log.target.addStream({
      type: 'raw',
      level: process.env.LOG_LEVEL || 'trace',
      stream: bsyslog.createBunyanStream({
        name: 'pull',
        host: syslogHost,
        port: syslogPort
      })
    })
  }
}
