'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Upload, Users, RefreshCw, TrendingUp, Target, Calendar, AlertCircle, CheckCircle, ArrowRightLeft, Clock, Settings, Percent, Hash, FileSpreadsheet, FileUp, FileDown } from 'lucide-react'

interface Metricas {
  resumen: {
    total: number
    reinscritos: number
    bajasTransferencia: number
    bajasReales: number
    porReinscribir: number
    nuevos: number
    meta: number
    porcentajeCumplimiento: number
    tipoMeta: string
    valorMeta: number
    porcentajeActual: number
  }
  porGrupo: GrupoMetrica[]
  timeline: TimelineItem[]
  estatusOriginal: Record<string, number>
  metaGlobal: {
    id: string
    tipo: string
    grupo: string | null
    meta: number
    tipoMeta: string
    valorMeta: number
  } | null
}

interface GrupoMetrica {
  grupo: string
  total: number
  reinscritos: number
  bajasTransferencia: number
  bajasReales: number
  porReinscribir: number
  nuevos: number
  porcentaje: number
  meta: number | null
  tipoMeta: string
  valorMeta: number
  porcentajeCumplimiento: number
}

interface TimelineItem {
  fecha: string
  cantidad: number
  acumulado: number
}

interface ImportStatus {
  alumnos_25_26: number
  alumnos_26_27: number
  clasificados: number
}

interface Meta {
  id: string
  tipo: string
  grupo: string | null
  meta: number
  tipoMeta: string
  valorMeta: number
}

const COLORS = {
  reinscritos: '#22c55e',
  bajasTransferencia: '#f59e0b',
  bajasReales: '#ef4444',
  porReinscribir: '#6b7280',
  nuevos: '#3b82f6'
}

const chartConfig: ChartConfig = {
  reinscritos: { label: 'Reinscritos', color: COLORS.reinscritos },
  bajasTransferencia: { label: 'Bajas Transferencia', color: COLORS.bajasTransferencia },
  bajasReales: { label: 'Bajas Reales', color: COLORS.bajasReales },
  porReinscribir: { label: 'Por Reinscribir', color: COLORS.porReinscribir },
  nuevos: { label: 'Nuevos', color: COLORS.nuevos },
  cantidad: { label: 'Reinscripciones', color: '#22c55e' },
  acumulado: { label: 'Acumulado', color: '#3b82f6' }
}

export default function Dashboard() {
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [metas, setMetas] = useState<Meta[]>([])
  const [metaDialogOpen, setMetaDialogOpen] = useState(false)
  const [nuevaMeta, setNuevaMeta] = useState('')
  const [metaGrupo, setMetaGrupo] = useState('')
  const [metaTipo, setMetaTipo] = useState<'global' | 'grupo'>('global')
  const [metaValorTipo, setMetaValorTipo] = useState<'numero' | 'porcentaje'>('porcentaje')
  const [activeTab, setActiveTab] = useState('dashboard')

  // Estados para subir archivos
  const [selectedFile2526, setSelectedFile2526] = useState<File | null>(null)
  const [selectedFile2627, setSelectedFile2627] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  useEffect(() => {
    cargarImportStatus()
    cargarMetricas()
    cargarMetas()
  }, [])

  const cargarImportStatus = async () => {
    try {
      const res = await fetch('/api/import')
      if (res.ok) {
        const data = await res.json()
        setImportStatus(data)
      }
    } catch (error) {
      console.error('Error al cargar estado:', error)
    }
  }

  const cargarMetricas = async () => {
    try {
      const res = await fetch('/api/metricas')
      if (res.ok) {
        const data = await res.json()
        setMetricas(data)
      }
    } catch (error) {
      console.error('Error al cargar métricas:', error)
    }
  }

  const cargarMetas = async () => {
    try {
      const res = await fetch('/api/metas')
      if (res.ok) {
        const data = await res.json()
        setMetas(data)
      }
    } catch (error) {
      console.error('Error al cargar metas:', error)
    }
  }

  // Función para subir archivo 25-26
  const handleUpload2526 = async () => {
    if (!selectedFile2526) return

    setUploading(true)

    const formData = new FormData()
    formData.append('file', selectedFile2526)
    formData.append('tipo', '25-26')

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (res.ok) {
        alert(`✅ ${data.message}\n\nTamaño: ${(data.size / 1024).toFixed(2)} KB`)
        setSelectedFile2526(null)
        cargarImportStatus()
      } else {
        alert(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al subir el archivo')
    } finally {
      setUploading(false)
    }
  }

  // Función para subir archivo 26-27
  const handleUpload2627 = async () => {
    if (!selectedFile2627) return

    setUploading(true)

    const formData = new FormData()
    formData.append('file', selectedFile2627)
    formData.append('tipo', '26-27')

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (res.ok) {
        alert(`✅ ${data.message}\n\nTamaño: ${(data.size / 1024).toFixed(2)} KB`)
        setSelectedFile2627(null)
        cargarImportStatus()
      } else {
        alert(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al subir el archivo')
    } finally {
      setUploading(false)
    }
  }

  const importarDatos = async (tipo: '25-26' | '26-27') => {
    setLoading(true)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo })
      })
      const data = await res.json()
      if (res.ok) {
        alert(data.message)
        cargarImportStatus()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const procesarDatos = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'procesar' })
      })
      const data = await res.json()
      if (res.ok) {
        alert(data.message)
        cargarMetricas()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const guardarMeta = async () => {
    if (!nuevaMeta) return

    try {
      const res = await fetch('/api/metas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: metaTipo,
          grupo: metaTipo === 'grupo' ? metaGrupo : null,
          tipoMeta: metaValorTipo,
          valorMeta: parseFloat(nuevaMeta)
        })
      })
      if (res.ok) {
        cargarMetas()
        cargarMetricas()
        setMetaDialogOpen(false)
        setNuevaMeta('')
        setMetaGrupo('')
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  // Función para exportar a PDF
  const exportarPDF = async () => {
    setExportingPdf(true)
    try {
      const res = await fetch('/api/export/pdf')
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'Reporte_Reinscripcion_por_Grupo.pdf'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const error = await res.json()
        alert(`Error al exportar PDF: ${error.error}`)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al exportar el PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  const pieData = metricas ? [
    { name: 'Reinscritos', value: metricas.resumen.reinscritos, fill: COLORS.reinscritos },
    { name: 'Bajas Transferencia', value: metricas.resumen.bajasTransferencia, fill: COLORS.bajasTransferencia },
    { name: 'Bajas Reales', value: metricas.resumen.bajasReales, fill: COLORS.bajasReales },
    { name: 'Por Reinscribir', value: metricas.resumen.porReinscribir, fill: COLORS.porReinscribir },
    { name: 'Nuevos', value: metricas.resumen.nuevos, fill: COLORS.nuevos }
  ] : []

  const barData = metricas?.porGrupo.map(g => ({
    grupo: g.grupo,
    reinscritos: g.reinscritos,
    pendientes: g.porReinscribir,
    bajas: g.bajasTransferencia + g.bajasReales
  })) || []

  const timelineData = metricas?.timeline.map(t => ({
    fecha: new Date(t.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
    cantidad: t.cantidad,
    acumulado: t.acumulado
  })) || []

  const getMetaInfo = () => {
    if (!metricas) return null

    const { resumen } = metricas
    const tieneMeta = resumen.meta > 0

    if (!tieneMeta) {
      return {
        labelMeta: 'Sin definir',
        progreso: 0,
        faltantes: 0,
        textoFaltantes: ''
      }
    }

    if (resumen.tipoMeta === 'porcentaje') {
      const porcentajeObjetivo = resumen.valorMeta
      const porcentajeActual = resumen.porcentajeActual
      const progreso = Math.min(100, (porcentajeActual / porcentajeObjetivo) * 100)

      return {
        labelMeta: `${porcentajeObjetivo}% (${resumen.meta} alumnos)`,
        progreso: progreso,
        faltantes: Math.max(0, resumen.meta - resumen.reinscritos),
        textoFaltantes: `Faltan ${Math.max(0, resumen.meta - resumen.reinscritos)} alumnos para el ${porcentajeObjetivo}%`
      }
    } else {
      return {
        labelMeta: `${resumen.meta} alumnos`,
        progreso: resumen.porcentajeCumplimiento,
        faltantes: Math.max(0, resumen.meta - resumen.reinscritos),
        textoFaltante: `Faltan ${Math.max(0, resumen.meta - resumen.reinscritos)} alumnos`
      }
    }
  }

  const metaInfo = getMetaInfo()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2 rounded-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Sistema de Reinscripción
              </h1>
              <p className="text-sm text-slate-500">Ciclo Escolar 2025-2026 → 2026-2027</p>
            </div>
          </div>

          {importStatus && (
            <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                25-26: {importStatus.alumnos_25_26}
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                26-27: {importStatus.alumnos_26_27}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4 text-blue-500" />
                Clasificados: {importStatus.clasificados}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="grupos">Por Grupo</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
          </TabsList>

          {/* Tab Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            {importStatus && importStatus.clasificados === 0 && (
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <AlertTitle>Configuración necesaria</AlertTitle>
                <AlertDescription>
                  Por favor, vaya a la pestaña &quot;Config&quot; para subir los archivos Excel y procesar los datos.
                </AlertDescription>
              </Alert>
            )}

            {/* KPIs */}
            {metricas && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-slate-300">Total a Reinscribir</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{metricas.resumen.total}</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-emerald-100">Reinscritos</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{metricas.resumen.reinscritos}</div>
                    <div className="text-sm text-emerald-100">
                      {metricas.resumen.porcentajeActual}% del total
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-amber-100">Transferencias</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{metricas.resumen.bajasTransferencia}</div>
                    <div className="text-sm text-amber-100">Cambios de campus</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-red-100">Bajas Reales</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{metricas.resumen.bajasReales}</div>
                    <div className="text-sm text-red-100">Salidas definitivas</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-slate-500 to-slate-600 text-white">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-slate-200">Por Reinscribir</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{metricas.resumen.porReinscribir}</div>
                    <div className="text-sm text-slate-200">Pendientes</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-blue-100">Nuevos</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{metricas.resumen.nuevos}</div>
                    <div className="text-sm text-blue-100">Inscripciones nuevas</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Meta Global */}
            {metricas && metaInfo && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-emerald-500" />
                      Meta de Reinscripción Global
                    </CardTitle>
                    <CardDescription>
                      Progreso hacia la meta establecida
                    </CardDescription>
                  </div>
                  <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Configurar Meta
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Configurar Meta de Reinscripción</DialogTitle>
                        <DialogDescription>
                          Establezca la meta de reinscripción. Puede elegir entre número absoluto o porcentaje.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Alcance de la Meta</Label>
                          <div className="flex gap-2">
                            <Button
                              variant={metaTipo === 'global' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setMetaTipo('global')}
                              className="flex-1"
                            >
                              Global (Campus)
                            </Button>
                            <Button
                              variant={metaTipo === 'grupo' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setMetaTipo('grupo')}
                              className="flex-1"
                            >
                              Por Grupo
                            </Button>
                          </div>
                        </div>

                        {metaTipo === 'grupo' && (
                          <div className="space-y-2">
                            <Label>Seleccionar Grupo</Label>
                            <select
                              className="w-full border rounded-md p-2"
                              value={metaGrupo}
                              onChange={(e) => setMetaGrupo(e.target.value)}
                            >
                              <option value="">Seleccione un grupo</option>
                              {metricas.porGrupo.map(g => (
                                <option key={g.grupo} value={g.grupo}>{g.grupo} ({g.total} alumnos)</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Tipo de Meta</Label>
                          <div className="flex gap-2">
                            <Button
                              variant={metaValorTipo === 'porcentaje' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setMetaValorTipo('porcentaje')}
                              className="flex-1"
                            >
                              <Percent className="h-4 w-4 mr-1" />
                              Porcentaje
                            </Button>
                            <Button
                              variant={metaValorTipo === 'numero' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setMetaValorTipo('numero')}
                              className="flex-1"
                            >
                              <Hash className="h-4 w-4 mr-1" />
                              Número
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>
                            {metaValorTipo === 'porcentaje'
                              ? 'Meta de Reinscripción (%)'
                              : 'Meta de Reinscripción (alumnos)'}
                          </Label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={nuevaMeta}
                              onChange={(e) => setNuevaMeta(e.target.value)}
                              placeholder={metaValorTipo === 'porcentaje' ? 'Ej: 85' : 'Ej: 300'}
                              className="pr-12"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                              {metaValorTipo === 'porcentaje' ? '%' : 'alumnos'}
                            </span>
                          </div>
                          {metaValorTipo === 'porcentaje' && (
                            <p className="text-xs text-slate-500">
                              El sistema calculará automáticamente el número de alumnos equivalente
                            </p>
                          )}
                        </div>

                        {nuevaMeta && (
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              Vista previa:
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Meta: {metaValorTipo === 'porcentaje'
                                ? `${nuevaMeta}% de reinscripción`
                                : `${nuevaMeta} alumnos reinscritos`}
                            </p>
                            {metaValorTipo === 'porcentaje' && metricas && (
                              <p className="text-xs text-slate-500 mt-1">
                                Equivale a {Math.round((parseFloat(nuevaMeta) / 100) *
                                  (metaTipo === 'grupo'
                                    ? (metricas.porGrupo.find(g => g.grupo === metaGrupo)?.total || 0)
                                    : metricas.resumen.total))} alumnos
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setMetaDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button
                          onClick={guardarMeta}
                          disabled={!nuevaMeta || (metaTipo === 'grupo' && !metaGrupo)}
                        >
                          Guardar Meta
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="text-slate-600 dark:text-slate-400">
                          Reinscritos: <strong className="text-emerald-600">{metricas.resumen.reinscritos}</strong>
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          Total: <strong>{metricas.resumen.total}</strong>
                        </span>
                      </div>
                      <span className="text-slate-600 dark:text-slate-400">
                        Meta: <strong className="text-blue-600">{metaInfo.labelMeta}</strong>
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progreso actual</span>
                        <span className="font-medium">
                          {metricas.resumen.tipoMeta === 'porcentaje'
                            ? `${metricas.resumen.porcentajeActual}% de ${metricas.resumen.valorMeta}%`
                            : `${metricas.resumen.porcentajeCumplimiento}%`}
                        </span>
                      </div>
                      <Progress
                        value={metaInfo.progreso}
                        className="h-3"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge
                        variant={metaInfo.progreso >= 100 ? 'default' : 'secondary'}
                        className={metaInfo.progreso >= 100 ? 'bg-emerald-500' : ''}
                      >
                        {metricas.resumen.tipoMeta === 'porcentaje'
                          ? `${Math.round(metaInfo.progreso)}% de la meta`
                          : `${metricas.resumen.porcentajeCumplimiento}% de cumplimiento`}
                      </Badge>
                      {metricas.resumen.meta > 0 && metricas.resumen.reinscritos < metricas.resumen.meta && (
                        <span className="text-sm text-slate-500">
                          {metricas.resumen.tipoMeta === 'porcentaje'
                            ? `Faltan ${metaInfo.faltantes} alumnos para el ${metricas.resumen.valorMeta}%`
                            : `Faltan ${metaInfo.faltantes} alumnos`}
                        </span>
                      )}
                      {metricas.resumen.reinscritos >= metricas.resumen.meta && metricas.resumen.meta > 0 && (
                        <Badge className="bg-emerald-500 text-white">
                          🎉 ¡Meta alcanzada!
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gráficos de Distribución */}
            {metricas && metricas.resumen.total > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Distribución de Estatus</CardTitle>
                    <CardDescription>
                      Clasificación de alumnos por estado de reinscripción
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                            labelLine={true}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                    {/* Leyenda personalizada */}
                    <div className="flex flex-wrap justify-center gap-4 mt-4">
                      {pieData.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: entry.fill }}
                          />
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {entry.name}: <strong>{entry.value}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Avance por Grupo (Top 10)</CardTitle>
                    <CardDescription>
                      Reinscritos vs Pendientes por grupo - Pasa el mouse sobre cada barra para ver detalles
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData.slice(0, 10)} layout="vertical" margin={{ right: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="grupo" type="category" width={60} tick={{ fontSize: 11 }} />
                          <ChartTooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-white dark:bg-slate-800 border rounded-lg p-3 shadow-lg">
                                    <p className="font-bold text-sm mb-2">{label}</p>
                                    <div className="space-y-1 text-sm">
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.reinscritos }} />
                                        <span>Reinscritos: <strong>{data.reinscritos}</strong></span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.porReinscribir }} />
                                        <span>Pendientes: <strong>{data.pendientes}</strong></span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.bajasReales }} />
                                        <span>Bajas: <strong>{data.bajas}</strong></span>
                                      </div>
                                      <div className="border-t pt-1 mt-1">
                                        <span>Total: <strong>{data.reinscritos + data.pendientes + data.bajas}</strong></span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar
                            dataKey="reinscritos"
                            stackId="a"
                            fill={COLORS.reinscritos}
                            name="Reinscritos"
                            radius={[0, 0, 0, 0]}
                          />
                          <Bar
                            dataKey="pendientes"
                            stackId="a"
                            fill={COLORS.porReinscribir}
                            name="Pendientes"
                          />
                          <Bar
                            dataKey="bajas"
                            stackId="a"
                            fill={COLORS.bajasReales}
                            name="Bajas"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                    {/* Leyenda con totales */}
                    <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.reinscritos }} />
                        <span className="text-sm">Reinscritos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.porReinscribir }} />
                        <span className="text-sm">Por Reinscribir</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.bajasReales }} />
                        <span className="text-sm">Bajas</span>
                      </div>
                    </div>
                    {/* Tabla resumida */}
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-slate-500 mb-2">Resumen numérico:</p>
                      <div className="grid grid-cols-5 gap-2 text-xs">
                        {barData.slice(0, 10).map((g, i) => (
                          <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                            <p className="font-bold">{g.grupo}</p>
                            <p className="text-emerald-600">{g.reinscritos} ✅</p>
                            <p className="text-slate-500">{g.pendientes} ⏳</p>
                            <p className="text-slate-400">Total: {g.reinscritos + g.pendientes + g.bajas}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Tab Por Grupo */}
          <TabsContent value="grupos" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Desglose por Grupo</CardTitle>
                  <CardDescription>
                    Análisis detallado del avance de reinscripción por cada grupo
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportarPDF}
                  disabled={exportingPdf || !metricas || metricas.porGrupo.length === 0}
                  className="gap-2"
                >
                  {exportingPdf ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Exportando...
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4" />
                      Exportar PDF
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Grupo</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Reinscritos</TableHead>
                        <TableHead className="text-center">Transferencias</TableHead>
                        <TableHead className="text-center">Bajas</TableHead>
                        <TableHead className="text-center">Pendientes</TableHead>
                        <TableHead className="text-center">Nuevos</TableHead>
                        <TableHead className="text-center">Avance</TableHead>
                        <TableHead className="text-center">Meta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metricas?.porGrupo.map((grupo) => (
                        <TableRow key={grupo.grupo}>
                          <TableCell className="font-medium">{grupo.grupo}</TableCell>
                          <TableCell className="text-center">{grupo.total}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="default" className="bg-emerald-500">
                              {grupo.reinscritos}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                              {grupo.bajasTransferencia}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="destructive">
                              {grupo.bajasReales}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">
                              {grupo.porReinscribir}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              {grupo.nuevos}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <Progress value={grupo.porcentaje} className="w-16 h-2" />
                              <span className="text-sm font-medium">{grupo.porcentaje}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {grupo.meta ? (
                              <div className="text-sm">
                                <span className="font-medium">
                                  {grupo.tipoMeta === 'porcentaje' ? `${grupo.valorMeta}%` : grupo.meta}
                                </span>
                                <Progress value={grupo.porcentajeCumplimiento} className="w-12 h-1.5 mt-1" />
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Timeline */}
          <TabsContent value="timeline" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Evolución Temporal de Reinscripciones
                </CardTitle>
                <CardDescription>
                  Comportamiento histórico de reinscripciones desde noviembre 2025
                </CardDescription>
              </CardHeader>
              <CardContent>
                {timelineData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="cantidad"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={{ fill: '#22c55e', r: 4 }}
                          name="Diario"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="acumulado"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ fill: '#3b82f6', r: 4 }}
                          name="Acumulado"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay datos de timeline disponibles</p>
                    <p className="text-sm">Importe y procese los datos para ver la evolución temporal</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {metricas && metricas.timeline.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Total Reinscritos</p>
                        <p className="text-2xl font-bold">{metricas.resumen.reinscritos}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Calendar className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Días con Actividad</p>
                        <p className="text-2xl font-bold">{metricas.timeline.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Target className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Promedio Diario</p>
                        <p className="text-2xl font-bold">
                          {metricas.timeline.length > 0
                            ? Math.round(metricas.resumen.reinscritos / metricas.timeline.length)
                            : 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Tab Configuración */}
          <TabsContent value="config" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Subir Archivos Excel
                </CardTitle>
                <CardDescription>
                  Sube los archivos Excel directamente desde aquí. El sistema los procesará automáticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertTitle>Archivos soportados</AlertTitle>
                  <AlertDescription>
                    Puedes subir archivos Excel (.xlsx o .xls) directamente desde esta pantalla.
                    <ul className="mt-2 list-disc list-inside text-sm">
                      <li><strong>25-26.xlsx</strong> - Reporte de alumnos del ciclo actual (base)</li>
                      <li><strong>26-27.xlsx</strong> - Reporte de reinscripción del siguiente ciclo</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                {/* Subir archivos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-2 hover:border-emerald-200 transition-colors">
                    <CardContent className="pt-6">
                      <div className="text-center space-y-4">
                        <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                          <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-emerald-700">Subir 25-26</h3>
                          <p className="text-sm text-slate-500">Base de alumnos actual</p>
                        </div>
                        <div className="space-y-2">
                          <Input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setSelectedFile2526(file);
                              }
                            }}
                            className="hidden"
                            id="file-25-26-upload"
                          />
                          <label
                            htmlFor="file-25-26-upload"
                            className="cursor-pointer"
                          >
                            <div className={`flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg transition-all ${selectedFile2526 ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:border-slate-300'}`}>
                              <FileUp className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                {selectedFile2526 ? selectedFile2526.name : 'Seleccionar archivo Excel'}
                              </span>
                            </div>
                          </label>
                          <Button
                            onClick={handleUpload2526}
                            disabled={uploading || !selectedFile2526}
                            className="w-full bg-emerald-500 hover:bg-emerald-600"
                          >
                            {uploading ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            Subir Archivo
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 hover:border-blue-200 transition-colors">
                    <CardContent className="pt-6">
                      <div className="text-center space-y-4">
                        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-blue-700">Subir 26-27</h3>
                          <p className="text-sm text-slate-500">Estado de reinscripción</p>
                        </div>
                        <div className="space-y-2">
                          <Input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setSelectedFile2627(file);
                              }
                            }}
                            className="hidden"
                            id="file-26-27-upload"
                          />
                          <label
                            htmlFor="file-26-27-upload"
                            className="cursor-pointer"
                          >
                            <div className={`flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg transition-all ${selectedFile2627 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300'}`}>
                              <FileUp className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                {selectedFile2627 ? selectedFile2627.name : 'Seleccionar archivo Excel'}
                              </span>
                            </div>
                          </label>
                          <Button
                            onClick={handleUpload2627}
                            disabled={uploading || !selectedFile2627}
                            className="w-full bg-blue-500 hover:bg-blue-600"
                          >
                            {uploading ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            Subir Archivo
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Estado actual */}
                {importStatus && (
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                      Estado de Datos en Sistema
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-emerald-600">{importStatus.alumnos_25_26}</p>
                        <p className="text-sm text-slate-500">Alumnos 25-26</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{importStatus.alumnos_26_27}</p>
                        <p className="text-sm text-slate-500">Alumnos 26-27</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-purple-600">{importStatus.clasificados}</p>
                        <p className="text-sm text-slate-500">Clasificados</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Acciones de procesamiento */}
                <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                  <Button
                    onClick={() => importarDatos('25-26')}
                    disabled={loading}
                    variant="outline"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Importar 25-26
                  </Button>
                  <Button
                    onClick={() => importarDatos('26-27')}
                    disabled={loading}
                    variant="outline"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Importar 26-27
                  </Button>
                  <Button
                    onClick={procesarDatos}
                    disabled={loading || !importStatus || (importStatus.alumnos_25_26 === 0 && importStatus.alumnos_26_27 === 0)}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                    )}
                    Procesar y Clasificar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Gestión de Metas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Metas Configuradas
                </CardTitle>
                <CardDescription>
                  Metas de reinscripción establecidas para el seguimiento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {metas.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Alcance</TableHead>
                        <TableHead>Grupo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Meta</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metas.map((meta) => (
                        <TableRow key={meta.id}>
                          <TableCell>
                            <Badge variant={meta.tipo === 'global' ? 'default' : 'secondary'}>
                              {meta.tipo === 'global' ? 'Global' : 'Por Grupo'}
                            </Badge>
                          </TableCell>
                          <TableCell>{meta.grupo || 'Todo el campus'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              {meta.tipoMeta === 'porcentaje' ? (
                                <><Percent className="h-3 w-3" /> Porcentaje</>
                              ) : (
                                <><Hash className="h-3 w-3" /> Número</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {meta.tipoMeta === 'porcentaje'
                              ? `${meta.valorMeta}% (${meta.meta} alumnos)`
                              : `${meta.meta} alumnos`}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await fetch(`/api/metas?id=${meta.id}`, { method: 'DELETE' })
                                cargarMetas()
                                cargarMetricas()
                              }}
                            >
                              Eliminar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay metas configuradas</p>
                    <p className="text-sm">Use el botón &quot;Configurar Meta&quot; en el dashboard para agregar</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-slate-500">
          Sistema de Seguimiento de Reinscripción Escolar | Campus MITRAS
        </div>
      </footer>
    </div>
  )
}
