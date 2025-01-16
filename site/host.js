import { Peer } from "https://esm.sh/peerjs@1.5.4?bundle-deps"
import alpine from "https://cdn.jsdelivr.net/npm/alpinejs@3.14.8/+esm"

import genAnimal from "./animal.js"

const roomInfo = Object.fromEntries(
    new URL(document.location).searchParams.entries()
)

let conn = null

alpine.store(
    "app",
    {
        state: "initializing",
        get stateColor() {
            if (this.state === "initializing") {
                return { "--field-color": "var(--warning)" }
            }
            return { "--field-color": "var(--secondary)" }
        },
        peer: null,
        name: genAnimal(),
        fileName: null,
        partsIn: 0,
        partsCount: 0,
        get progress() {
            const prog = (this.partsIn / this.partsCount) * 100
            return `${prog.toFixed(2)}%`
        },
        modal: {
            copy: false,
        }
    }
)
alpine.store(
    "action",
    {
        acceptFile() {
            conn.send({ type: "acceptFile" })
        },
        async copyLink() {
            app.modal.copy = true
            const url = new URL(`/send?id=${roomInfo.id}`, document.location)
            await navigator.clipboard.writeText(url.href)
            setTimeout(
                () => app.modal.copy = false,
                3000
            )
        }
    }
)
const app = alpine.store("app")
alpine.start()

const id = `file-share_${roomInfo.id}`
const self = new Peer(id)
self.on(
    "open",
    () => app.state = "ready"
)
let fileParts = null
const handle = {
    peerName: async (peer) => {
        app.peer = peer
        await conn.send({ type: "hostName", msg: app.name })
    },
    initFile: async (filename) => {
        app.partsIn = 0
        app.partsCount = 0
        app.fileName = filename
    },
    fileHeader: (count) => {
        app.partsIn = 0
        app.partsCount = count
        // fileParts = []
        fileParts = Array.from({ length: count }, () => null)
    },
    filePart: (msg) => {
        const { part, index } = msg
        fileParts[index] = part
        app.partsIn += 1
        conn.send({ type: "partAck" })
        // fileParts.push(part)
        // app.fileProgress = fileParts.length / app.partsCount

        const nulls = fileParts.filter(part => part === null)
        if (nulls.length === 0) {
            const file = new Blob(fileParts)
            const fileURL = URL.createObjectURL(file)
            const link = document.createElement("a")
            link.href = fileURL
            link.download = app.fileName
            link.click()
        }
    },
    debug: (args) => console.log(args),
}
self.on(
    "connection",
    async (peer) => {
        if (app.peer !== null) {
            console.log("rejecting connection")
            await peer.send({ type: "reject" })
            conn.close()
            return
        }
        conn = peer
        conn.on(
            "close",
            () => {
                app.peer = null
            }
        )
        conn.on(
            "data",
            (data) => {
                console.log(data)
                handle[data.type](data.msg)
            }
        )
    }
)
