import { Peer } from "https://esm.sh/peerjs@1.5.4?bundle-deps"
import alpine from "https://cdn.jsdelivr.net/npm/alpinejs@3.14.8/+esm"

import genAnimal from "./animal.js"

const roomInfo = Object.fromEntries(
    new URL(document.location).searchParams.entries()
)

let conn = null

const initFileSend = async (file) => {
    app.file = file
    app.sent = null
    // await conn.send({ type: "debug", msg: app.file.slice(0, 10) })
    await conn.send({ type: "initFile", msg: file.name })
}

alpine.store(
    "app",
    {
        state: "connecting",
        name: genAnimal(),
        host: null,
        file: null,
        sent: null,
        total: null,

        get loading() {
            return this.state === "connecting"
        },
        get progress() {
            const prog = (this.sent / this.total) * 100
            return `${prog.toFixed(2)}%`
        },
        async pickFile() {
            const filePicker = document.createElement("input")
            filePicker.type = "file"
            filePicker.addEventListener(
                "change",
                (evt) => initFileSend(evt.target.files[0])
            )
            filePicker.click()
        },
        get stateColor() {
            if (this.state === "connecting") {
                return { "--field-color": "var(--warning)" }
            }
            if (this.state === "disconnected") {
                return { "--field-color": "var(--danger)" }
            }
            return { "--field-color": "var(--secondary)" }
        },
    }
)
const app = alpine.store("app")
alpine.start()

const self = new Peer()
window.peer = self
const handle = {
    hostName: (name) => app.host = name,
    acceptFile: async () => {
        const parts = Array.from(
            { length: Math.ceil(app.file.size / 4096) },
            (_, i) => app.file.slice(4096 * i, 4096 * (i + 1))
        )
        app.total = parts.length
        app.sent = 0
        await conn.send({ type: "fileHeader", msg: parts.length })
        let index = 0
        for (const part of parts) {
            await conn.send({
                type: "filePart",
                msg: { part, index }
            })
            // app.sent += 1
            index += 1
        }
    },
    partAck: async () => {
        app.sent += 1
    }
}
self.on(
    "open",
    () => {
        conn = self.connect(`file-share_${roomInfo.id}`)
        conn.on(
            "open",
            async () => {
                app.state = "connected"
                await conn.send({ type: "peerName", msg: app.name })
            }
        )
        conn.on(
            "data",
            (data) => {
                console.log(data)
                handle[data.type](data.msg)
            }
        )
        conn.on(
            "close",
            () => {
                app.host = null
                app.state = "disconnected"
            }
        )
        window.other = conn
    }
)
