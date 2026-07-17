import { validateEnv, config } from './config/env.js'

validateEnv()

const { default: app } = await import('./app.js')

app.listen(config.port, () => {
    console.log(`BACKEND-PROMPTOOL escuchando en http://localhost:${config.port}`)
})
