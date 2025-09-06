import { contextBridge } from 'electron'
import { conveyor } from '@/lib/conveyor/api'
import { websiteApi } from './website-api'
// VLC API removed - we no longer need renderer-side VLC controls

// Use `contextBridge` APIs to expose APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('conveyor', conveyor)
    contextBridge.exposeInMainWorld('websiteApi', websiteApi)
    contextBridge.exposeInMainWorld('isElectron', true)
  } catch (error) {
    console.error(error)
  }
} else {
  window.conveyor = conveyor
  window.websiteApi = websiteApi
  window.isElectron = true
}
