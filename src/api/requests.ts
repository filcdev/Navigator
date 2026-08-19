import axios from "axios"
import { invoke } from "@tauri-apps/api/core"
import { normalizeError } from "./errors"

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001"

interface BackendConfig {
    backend_url: string
    trust_ssl: boolean
}

const axiosInstance = axios.create({
    baseURL: DEFAULT_BASE_URL,
    withCredentials: true
})

/**
 * Resolves the backend URL at runtime from the Tauri config written by Ansible
 * (/etc/navigator/backend.json). Falls back to the build-time default when not
 * running under Tauri or when the file is missing/unreadable.
 */
export async function initBackend(): Promise<string> {
    try {
        const config = await invoke<BackendConfig>("get_backend_config")
        if (config?.backend_url?.trim()) {
            axiosInstance.defaults.baseURL = config.backend_url.trim()
        }
    } catch {
        // not running under Tauri, or config missing — keep the build-time default
    }
    return axiosInstance.defaults.baseURL as string
}

export async function get_request<T>(path: string): Promise<T> {
    try {
        const response = await axiosInstance.get(path)

        return response.data as T
    } catch (error: unknown) {
        throw normalizeError(error)
    }
}

export async function post_put_request<T, R = T>(
    method: "POST" | "PUT" | "PATCH",
    path: string,
    body: T
): Promise<R> {
    try {
        const response = await axiosInstance.request({
            method: method,
            url: path,
            data: body
        })

        return response.data as R
    } catch (error: unknown) {
        throw normalizeError(error)
    }
}

export async function delete_request<T, R = T>(path: string, body?: T): Promise<R> {
    try {
        const response = await axiosInstance.delete(path, { data: body })

        return response.data as R
    } catch (error: unknown) {
        throw normalizeError(error)
    }
}
