import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function PortalAdmin({ onLogout }) {
  const [vistaActiva, setVistaActiva] = useState('estadisticas'); // 'estadisticas', 'usuarios', 'bitacora'
  const [cargando, setCargando] = useState(false);
  const [mostrarSidebar, setMostrarSidebar] = useState(false);

  // Estados para la data
  const [estadisticas, setEstadisticas] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [logs, setLogs] = useState({ auth: [], quejas: [] });
  const [tabBitacora, setTabBitacora] = useState('auth');
  const [filtros, setFiltros] = useState({ usuario: '', rol: '', fecha: '', ticket: '' });
  const [solicitudes, setSolicitudes] = useState([]);
  const [filtrosUsuarios, setFiltrosUsuarios] = useState({ texto: '', rol: '' });
  const [tabUsuarios, setTabUsuarios] = useState('lista');

  const nombreParaMostrar = "Administrador del Sistema";
  const iniciales = "AD";

  useEffect(() => {
    cargarDatosVista(vistaActiva);
  }, [vistaActiva]);

  const obtenerToken = () => {
    let tokenString = localStorage.getItem('token');
    if (tokenString && tokenString.startsWith('{')) {
      return JSON.parse(tokenString).token || tokenString;
    }
    return tokenString;
  };

  const cargarDatosVista = async (vista) => {
    setCargando(true);
    const token = obtenerToken();
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      if (vista === 'estadisticas') {
        const res = await fetch('/api/quejas/admin/estadisticas', { headers });
        if (res.ok) setEstadisticas(await res.json());
      } else if (vista === 'usuarios') {
        const res = await fetch('/api/quejas/admin/usuarios', { headers });
        if (res.ok) setUsuarios(await res.json());
        const resSol = await fetch('/api/quejas/admin/solicitudes', { headers });
        if (resSol.ok) setSolicitudes(await resSol.json());
      } else if (vista === 'bitacora') {
        const res = await fetch('/api/quejas/admin/bitacora', { headers });
        if (res.ok) setLogs(await res.json());
      }
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setCargando(false);
    }
  };

  const toggleEstadoUsuario = async (id) => {
    const token = obtenerToken();
    await fetch(`/api/quejas/admin/usuarios/${id}/toggle-estado`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    cargarDatosVista('usuarios');
  };

  const exportarBitacoraCSV = () => {
    const listaActiva = tabBitacora === 'auth' ? (logs.auth || []) : (logs.quejas || []);
    const logsFiltrados = listaActiva.filter(log => {
      const matchUsuario = log.usuario.toLowerCase().includes(filtros.usuario.toLowerCase());
      const matchRol = log.rol.toLowerCase().includes(filtros.rol.toLowerCase());
      const matchFecha = log.fecha.includes(filtros.fecha);
      const matchTicket = tabBitacora === 'quejas' ? log.id.toLowerCase().includes(filtros.ticket.toLowerCase()) : true;
      return matchUsuario && matchRol && matchFecha && matchTicket;
    });

    if (logsFiltrados.length === 0) return;

    const cabeceras = tabBitacora === 'auth' ? "ID,Usuario,Rol,Acción,Fecha,IP\n" : "Ticket,Usuario,Acción,Fecha,IP\n";
    const filas = logsFiltrados.map(l =>
      tabBitacora === 'auth'
        ? `${l.id},${l.usuario},${l.rol},"${l.descripcion}",${l.fecha},${l.ip}`
        : `${l.id},${l.usuario},"${l.descripcion}",${l.fecha},${l.ip}`
    ).join("\n");

    const csvContent = "data:text/csv;charset=utf-8," + cabeceras + filas;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bitacora_${tabBitacora}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Nueva función para PDF
  const exportarBitacoraPDF = () => {
    const listaActiva = tabBitacora === 'auth' ? (logs.auth || []) : (logs.quejas || []);
    const logsFiltrados = listaActiva.filter(log => {
      const matchUsuario = log.usuario.toLowerCase().includes(filtros.usuario.toLowerCase());
      const matchRol = log.rol.toLowerCase().includes(filtros.rol.toLowerCase());
      const matchFecha = log.fecha.includes(filtros.fecha);
      const matchTicket = tabBitacora === 'quejas' ? log.id.toLowerCase().includes(filtros.ticket.toLowerCase()) : true;
      return matchUsuario && matchRol && matchFecha && matchTicket;
    });

    if (logsFiltrados.length === 0) return;

    const doc = new jsPDF();
    doc.text(`Bitácora de ${tabBitacora === 'auth' ? 'Accesos' : 'Operaciones (Quejas)'}`, 14, 15);

    const tableColumn = tabBitacora === 'auth'
      ? ["Fecha y Hora", "Usuario", "Rol", "Acción", "IP"]
      : ["Ticket", "Fecha y Hora", "Usuario", "Acción", "IP"];

    const tableRows = logsFiltrados.map(log => {
      return tabBitacora === 'auth'
        ? [log.fecha.substring(0, 19).replace('T', ' '), log.usuario, log.rol, log.descripcion, log.ip]
        : [log.id, log.fecha.substring(0, 19).replace('T', ' '), log.usuario, log.descripcion, log.ip];
    });

    // NUEVA FORMA DE LLAMAR A AUTOTABLE
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save(`bitacora_${tabBitacora}.pdf`);
  };

  return (
    <div className="portal-layout">
      {/* ================= SIDEBAR ================= */}
      <aside className={`sidebar ${mostrarSidebar ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo-circle-small">
            <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'white' }}>BCN</span>
          </div>
          <div className="brand-text">
            <h2 style={{ fontSize: '15px' }}>Banco Capital Nacional</h2>
            <p>PORTAL DE ADMINISTRACIÓN</p>
          </div>
        </div>

        <div className="sidebar-menu-title" style={{ marginTop: '10px' }}>GESTIÓN Y AUDITORÍA</div>

        <ul className="nav-list">
          <li className="nav-item">
            <button onClick={() => setVistaActiva('estadisticas')} className={`nav-btn ${vistaActiva === 'estadisticas' ? 'active' : ''}`}>
              📊 Estadísticas Globales
            </button>
          </li>
          <li className="nav-item">
            <button onClick={() => setVistaActiva('usuarios')} className={`nav-btn ${vistaActiva === 'usuarios' ? 'active' : ''}`}>
              👥 Gestión de Usuarios
            </button>
          </li>
          <li className="nav-item">
            <button onClick={() => setVistaActiva('bitacora')} className={`nav-btn ${vistaActiva === 'bitacora' ? 'active' : ''}`}>
              📑 Bitácora y Logs
            </button>
          </li>
        </ul>

        <div className="sidebar-footer">
          <button onClick={onLogout} className="btn-logout">Cerrar Sesión</button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <div className="main-wrapper">
        <header className="topbar" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button
              onClick={() => setMostrarSidebar(!mostrarSidebar)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#334155' }}
            >
              ☰
            </button>
          </div>
          <div className="user-profile">
            <div className="avatar" style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>{iniciales}</div>
            <span>{nombreParaMostrar}</span>
          </div>
        </header>

        <main className="content-area">
          <div className="content-card fade-in" style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>

            {/* VISTA 1: ESTADÍSTICAS PRO (TARJETAS + RECHARTS) */}
            {vistaActiva === 'estadisticas' && (
              <div className="fade-in" style={{ padding: '10px 20px', backgroundColor: '#f8fafc', minHeight: '100vh', borderRadius: '12px' }}>

                {/* ENCABEZADO */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                  <div>
                    <h1 style={{ color: '#0f172a', fontSize: '2.2rem', margin: '0 0 5px 0', fontWeight: '800', letterSpacing: '-0.5px' }}>
                      Dashboard Analítico
                    </h1>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '1rem' }}>Visión general y métricas de rendimiento interactivas</p>
                  </div>
                </div>

                {cargando ? (
                  <div style={{ display: 'flex', alignItems: 'center', color: '#64748b', fontWeight: '500', padding: '40px' }}>
                    <svg style={{ animation: 'spin 1s linear infinite', marginRight: '10px', height: '24px', width: '24px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sincronizando datos en tiempo real...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {/* ======================================================= */}
                    {/* SECCIÓN 1: KPIs PRINCIPALES (TOTAL + APROBADAS/DENEGADAS)*/}
                    {/* ======================================================= */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>

                      {/* Tarjeta de Total Principal */}
                      <div style={{
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                        padding: '30px', borderRadius: '20px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        position: 'relative', overflow: 'hidden', color: 'white'
                      }}>
                        <div style={{ position: 'absolute', top: '-20%', right: '-5%', width: '150px', height: '150px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}></div>
                        <div style={{ position: 'absolute', bottom: '-20%', right: '5%', width: '100px', height: '100px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}></div>
                        <p style={{ margin: 0, color: '#94a3b8', fontWeight: '600', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          TOTAL REGISTRADO
                        </p>
                        <h2 style={{ margin: '10px 0 0 0', fontSize: '3.5rem', fontWeight: '800', lineHeight: '1' }}>
                          {estadisticas?.total || 0}
                        </h2>
                      </div>

                      {/* Tarjetas resumen rápido (Aprobadas / Denegadas) */}
                      {(() => {
                        const aprobadas = estadisticas?.porEstado?.find(e => e.estado.toUpperCase().trim() === 'APROBADA')?.cantidad || 0;
                        const denegadas = estadisticas?.porEstado?.find(e => e.estado.toUpperCase().trim() === 'DENEGADA')?.cantidad || 0;

                        return (
                          <>
                            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22c55e', marginRight: '10px' }}></div>
                                <p style={{ margin: 0, color: '#64748b', fontWeight: '600' }}>Total Aprobadas</p>
                              </div>
                              <h2 style={{ margin: 0, fontSize: '3.5rem', color: '#0f172a', fontWeight: '800', lineHeight: '1' }}>{aprobadas}</h2>
                            </div>
                            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444', marginRight: '10px' }}></div>
                                <p style={{ margin: 0, color: '#64748b', fontWeight: '600' }}>Total Denegadas</p>
                              </div>
                              <h2 style={{ margin: 0, fontSize: '3.5rem', color: '#0f172a', fontWeight: '800', lineHeight: '1' }}>{denegadas}</h2>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* ======================================================= */}
                    {/* SECCIÓN 2: DESGLOSE POR ESTADO (TARJETAS)               */}
                    {/* ======================================================= */}
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                        {estadisticas?.porEstado && estadisticas.porEstado.length > 0 ? (
                          estadisticas.porEstado.map((item, index) => {
                            const coloresEstado = {
                              'APROBADA': { bg: '#dcfce7', text: '#15803d', border: '#22c55e' },
                              'DENEGADA': { bg: '#fee2e2', text: '#b91c1c', border: '#ef4444' },
                              'PENDIENTE': { bg: '#fef3c7', text: '#d97706', border: '#f59e0b' },
                              'EN PROCESO': { bg: '#e0f2fe', text: '#0284c7', border: '#0ea5e9' },
                              'NUEVA': { bg: '#f3e8ff', text: '#7e22ce', border: '#a855f7' },
                              'CERRADA': { bg: '#f1f5f9', text: '#475569', border: '#64748b' },
                              'RECHAZADA': { bg: '#fee2e2', text: '#b91c1c', border: '#ef4444' },
                              'RESUELTA': { bg: '#dcfce7', text: '#15803d', border: '#22c55e' },
                            };
                            const paletaDefecto = [
                              { bg: '#ccfbf1', text: '#0f766e', border: '#14b8a6' },
                              { bg: '#ffedd5', text: '#c2410c', border: '#f97316' },
                              { bg: '#fce7f3', text: '#be185d', border: '#db2777' },
                              { bg: '#e0e7ff', text: '#4338ca', border: '#6366f1' },
                            ];

                            const nombreEstado = item.estado ? item.estado.toUpperCase().trim() : '';
                            const tema = coloresEstado[nombreEstado] || paletaDefecto[index % paletaDefecto.length];
                            const porcentaje = estadisticas.total > 0 ? ((item.cantidad / estadisticas.total) * 100).toFixed(1) : 0;

                            return (
                              <div key={index} style={{
                                backgroundColor: 'white', padding: '24px', borderRadius: '16px', borderTop: `6px solid ${tema.border}`,
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'default'
                              }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-3px)';
                                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                  <p style={{ margin: 0, color: '#64748b', fontWeight: '600', fontSize: '0.85rem' }}>{item.estado}</p>
                                  <span style={{ backgroundColor: tema.bg, color: tema.text, padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>
                                    {porcentaje}%
                                  </span>
                                </div>
                                <h2 style={{ margin: 0, fontSize: '2.5rem', color: '#1e293b', fontWeight: '700' }}>{item.cantidad}</h2>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', border: '1px dashed #cbd5e1', gridColumn: '1 / -1', textAlign: 'center' }}>
                            <p style={{ color: '#64748b', margin: 0 }}>No hay datos por estado disponibles.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ======================================================= */}
                    {/* SECCIÓN 3: ANÁLISIS GRÁFICO INTERACTIVO (RECHARTS)      */}
                    {/* ======================================================= */}

                    {/* Fila de Gráficos: Dona (Estados) y Barras (Agentes) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>

                      {/* GRÁFICO 1: DONA DE ESTADOS */}
                      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                        <h3 style={{ margin: '0 0 20px 0', color: '#1e293b', fontSize: '1.2rem', fontWeight: '700' }}>Proporción por Estado</h3>
                        <div style={{ width: '100%', height: '300px' }}>
                          <ResponsiveContainer>
                            <PieChart>
                              <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} itemStyle={{ fontWeight: 'bold' }} />
                              <Pie data={estadisticas?.porEstado || []} innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="cantidad" nameKey="estado">
                                {(estadisticas?.porEstado || []).map((entry, index) => {
                                  const colores = {
                                    'APROBADA': '#22c55e', 'DENEGADA': '#ef4444', 'PENDIENTE': '#f59e0b',
                                    'EN PROCESO': '#0ea5e9', 'NUEVA': '#a855f7', 'CERRADA': '#64748b',
                                    'RECHAZADA': '#ef4444', 'RESUELTA': '#22c55e'
                                  };
                                  const color = colores[entry.estado.toUpperCase().trim()] || ['#14b8a6', '#f97316', '#db2777'][index % 3];
                                  return <Cell key={`cell-${index}`} fill={color} />;
                                })}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* GRÁFICO 2: BARRAS DE AGENTES */}
                      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                        <h3 style={{ margin: '0 0 20px 0', color: '#1e293b', fontSize: '1.2rem', fontWeight: '700' }}>Carga de Trabajo por Agente</h3>
                        <div style={{ width: '100%', height: '300px' }}>
                          <ResponsiveContainer>
                            <BarChart data={estadisticas?.porUsuario || []} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis
                                dataKey="email"
                                tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false}
                                tickFormatter={(value) => value.split('@')[0]} // Muestra solo el usuario sin el @dominio
                              />
                              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                              <Bar dataKey="cantidad" name="Quejas Asignadas" radius={[6, 6, 0, 0]}>
                                {(estadisticas?.porUsuario || []).map((entry, index) => {
                                  const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9'];
                                  return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Fila Inferior: Gráfico de Clientes (Barras Horizontales) */}
                    <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                      <h3 style={{ margin: '0 0 20px 0', color: '#1e293b', fontSize: '1.2rem', fontWeight: '700' }}>Top Clientes con más Quejas Registradas</h3>
                      <div style={{ width: '100%', height: '350px' }}>
                        <ResponsiveContainer>
                          <BarChart layout="vertical" data={estadisticas?.porCliente || []} margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                            <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis
                              dataKey="email"
                              type="category"
                              tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} width={150}
                              tickFormatter={(value) => value.length > 20 ? `${value.substring(0, 20)}...` : value}
                            />
                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }} />
                            <Bar dataKey="cantidad" name="Quejas del Cliente" radius={[0, 6, 6, 0]} barSize={24}>
                              {(estadisticas?.porCliente || []).map((entry, index) => {
                                const colorsCliente = ['#8b5cf6', '#ec4899', '#6366f1', '#d946ef', '#14b8a6'];
                                return <Cell key={`cell-${index}`} fill={colorsCliente[index % colorsCliente.length]} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* VISTA 2: USUARIOS ULTRA PRO */}
            {vistaActiva === 'usuarios' && (() => {
              // Filtro en tiempo real para el catálogo general
              const usuariosFiltrados = usuarios.filter(u => {
                const matchTexto = (u.nombreCompleto + " " + u.email).toLowerCase().includes(filtrosUsuarios.texto.toLowerCase());
                const matchRol = u.rol.toLowerCase().includes(filtrosUsuarios.rol.toLowerCase());
                return matchTexto && matchRol;
              });

              return (
                <div className="fade-in" style={{ padding: '10px 20px', backgroundColor: '#f8fafc', minHeight: '100vh', borderRadius: '12px' }}>

                  {/* ENCABEZADO */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                    <div>
                      <h1 style={{ color: '#0f172a', fontSize: '2.2rem', margin: '0 0 5px 0', fontWeight: '800', letterSpacing: '-0.5px' }}>
                        Gestión de Usuarios
                      </h1>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '1rem' }}>Administración de accesos, roles y solicitudes de activación</p>
                    </div>
                  </div>

                  {/* TABS DE NAVEGACIÓN ESTILO "PILL" */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    <button
                      onClick={() => setTabUsuarios('lista')}
                      style={{
                        padding: '12px 24px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem',
                        background: tabUsuarios === 'lista' ? '#1e293b' : 'white',
                        color: tabUsuarios === 'lista' ? 'white' : '#64748b',
                        border: tabUsuarios === 'lista' ? 'none' : '1px solid #e2e8f0',
                        borderRadius: '30px', boxShadow: tabUsuarios === 'lista' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.3s ease'
                      }}>
                      Catálogo de Usuarios
                    </button>
                    <button
                      onClick={() => setTabUsuarios('solicitudes')}
                      style={{
                        padding: '12px 24px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem',
                        background: tabUsuarios === 'solicitudes' ? '#1e293b' : 'white',
                        color: tabUsuarios === 'solicitudes' ? 'white' : '#64748b',
                        border: tabUsuarios === 'solicitudes' ? 'none' : '1px solid #e2e8f0',
                        borderRadius: '30px', boxShadow: tabUsuarios === 'solicitudes' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '10px'
                      }}>
                      Solicitudes de Activación
                      {solicitudes.length > 0 && (
                        <span style={{ background: '#ef4444', color: 'white', borderRadius: '50%', padding: '2px 8px', fontSize: '0.75rem', fontWeight: '800' }}>
                          {solicitudes.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* PESTAÑA 1: CATÁLOGO DE USUARIOS */}
                  {tabUsuarios === 'lista' && (
                    <div className="fade-in">

                      {/* BARRA DE FILTROS FLOTANTE PREMIUM */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px',
                        marginBottom: '30px', background: 'white', padding: '24px', borderRadius: '16px',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.02), 0 4px 6px -2px rgba(0,0,0,0.01)', border: '1px solid #f1f5f9'
                      }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Buscar por Nombre o Email</label>
                          <input
                            type="text" placeholder="Ej. Juan Pérez" value={filtrosUsuarios.texto}
                            onChange={(e) => setFiltrosUsuarios({ ...filtrosUsuarios, texto: e.target.value })}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', background: '#f8fafc', color: '#0f172a', transition: 'border-color 0.2s' }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'} onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filtrar por Rol</label>
                          <select
                            value={filtrosUsuarios.rol}
                            onChange={(e) => setFiltrosUsuarios({ ...filtrosUsuarios, rol: e.target.value })}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', background: '#f8fafc', color: '#0f172a', cursor: 'pointer' }}>
                            <option value="">Todos los Roles</option>
                            <option value="ADMIN">Admin</option>
                            <option value="GERENTE">Gerente</option>
                            <option value="JEFE">Jefe</option>
                            <option value="SUPERVISOR">Supervisor</option>
                            <option value="AGENTE_BANCARIO">Agente Bancario</option>
                            <option value="USUARIO_FINAL">Usuario Final</option>
                          </select>
                        </div>
                      </div>

                      {/* TABLA ULTRA PRO DE USUARIOS */}
                      <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', textAlign: 'left', minWidth: '800px' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc' }}>
                                <th style={{ padding: '18px 24px', color: '#475569', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' }}>Usuario</th>
                                <th style={{ padding: '18px 24px', color: '#475569', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' }}>Rol del Sistema</th>
                                <th style={{ padding: '18px 24px', color: '#475569', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' }}>Estado</th>
                                <th style={{ padding: '18px 24px', textAlign: 'right', color: '#475569', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' }}>Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {usuariosFiltrados.length === 0 ? (
                                <tr>
                                  <td colSpan="4" style={{ padding: '60px 20px', textAlign: 'center' }}>
                                    <h3 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>Sin resultados</h3>
                                    <p style={{ color: '#64748b', margin: 0 }}>No se encontraron usuarios que coincidan con la búsqueda.</p>
                                  </td>
                                </tr>
                              ) : (
                                usuariosFiltrados.map(user => {
                                  // Generador de Avatar con inicial
                                  const inicial = user.nombreCompleto ? user.nombreCompleto.charAt(0).toUpperCase() : '?';
                                  const coloresAvatares = ['linear-gradient(135deg, #3b82f6, #2563eb)', 'linear-gradient(135deg, #8b5cf6, #7c3aed)', 'linear-gradient(135deg, #10b981, #059669)', 'linear-gradient(135deg, #f59e0b, #d97706)', 'linear-gradient(135deg, #ec4899, #db2777)'];
                                  const colorAvatar = coloresAvatares[user.nombreCompleto ? user.nombreCompleto.charCodeAt(0) % coloresAvatares.length : 0];

                                  return (
                                    <tr
                                      key={user.id}
                                      style={{ transition: 'all 0.2s ease', borderBottom: '1px solid #f1f5f9', backgroundColor: 'white' }}
                                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.transform = 'scale(1.002)'; e.currentTarget.style.boxShadow = 'inset 4px 0 0 0 #3b82f6'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                                    >
                                      {/* NOMBRE Y CORREO CON AVATAR */}
                                      <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: colorAvatar, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1rem', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                            {inicial}
                                          </div>
                                          <div>
                                            <p style={{ margin: 0, fontWeight: '700', color: '#1e293b', fontSize: '0.95rem' }}>{user.nombreCompleto}</p>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{user.email}</p>
                                          </div>
                                        </div>
                                      </td>

                                      {/* ROL */}
                                      <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #cbd5e1', color: '#475569', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.5px', background: 'white' }}>
                                          {user.rol}
                                        </span>
                                      </td>

                                      {/* ESTADO */}
                                      <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                        <span style={{ color: user.activo ? '#15803d' : '#b91c1c', background: user.activo ? '#dcfce7' : '#fee2e2', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                          {user.activo ? '● Activo' : '● Inactivo'}
                                        </span>
                                      </td>

                                      {/* ACCIÓN */}
                                      <td style={{ padding: '16px 24px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                                        <button
                                          onClick={() => toggleEstadoUsuario(user.id)}
                                          style={{
                                            padding: '8px 16px',
                                            background: user.activo ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                            color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem',
                                            boxShadow: user.activo ? '0 2px 4px rgba(239, 68, 68, 0.2)' : '0 2px 4px rgba(16, 185, 129, 0.2)',
                                            transition: 'all 0.2s ease'
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                                          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                        >
                                          {user.activo ? 'Desactivar' : 'Activar'}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PESTAÑA 2: SOLICITUDES DE ACTIVACIÓN */}
                  {tabUsuarios === 'solicitudes' && (
                    <div className="fade-in">
                      {solicitudes.length === 0 ? (
                        <div style={{ padding: '60px 20px', textAlign: 'center', background: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1', color: '#64748b', fontWeight: '600', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                          <p style={{ margin: 0, fontSize: '1rem' }}>No hay solicitudes de activación pendientes en este momento.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gap: '20px' }}>
                          {solicitudes.map((sol, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: 'white', padding: '24px', borderRadius: '16px',
                                border: '1px solid #e2e8f0', borderLeft: '6px solid #f59e0b',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.05)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)'; }}
                            >
                              <div>
                                <p style={{ margin: '0 0 6px 0', fontWeight: '800', color: '#0f172a', fontSize: '1.1rem' }}>{sol.email}</p>
                                <p style={{ margin: '4px 0', color: '#475569', fontSize: '0.95rem' }}><strong style={{ color: '#1e293b' }}>Motivo de solicitud:</strong> {sol.motivo}</p>
                                <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '0.8rem', fontWeight: '600' }}>Enviado el: {sol.fecha}</p>
                              </div>
                              <button
                                onClick={async () => {
                                  await toggleEstadoUsuario(sol.usuarioId);
                                }}
                                style={{
                                  padding: '12px 24px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white',
                                  border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer',
                                  boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)', transition: 'all 0.2s ease', whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(16, 185, 129, 0.3)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(16, 185, 129, 0.2)'; }}
                              >
                                Aprobar y Activar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* VISTA 3: BITÁCORA ULTRA PRO */}
            {vistaActiva === 'bitacora' && (() => {
              const listaActiva = tabBitacora === 'auth' ? (logs.auth || []) : (logs.quejas || []);

              const logsFiltrados = listaActiva.filter(log => {
                const matchUsuario = log.usuario?.toLowerCase().includes(filtros.usuario.toLowerCase());
                const matchRol = log.rol?.toLowerCase().includes(filtros.rol.toLowerCase());
                const matchFecha = log.fecha?.includes(filtros.fecha);

                // Busca en todas las variaciones posibles del nombre de la propiedad
                const ticketReferencia = log.numeroTicket || log.numero_ticket || log.ticket || log.id || '';
                const matchTicket = tabBitacora === 'quejas' ? ticketReferencia.toString().toLowerCase().includes(filtros.ticket.toLowerCase()) : true;

                return matchUsuario && matchRol && matchFecha && matchTicket;
              });

              return (
                <div className="fade-in" style={{ padding: '10px 20px', backgroundColor: '#f8fafc', minHeight: '100vh', borderRadius: '12px' }}>

                  {/* ENCABEZADO Y BOTONES DE EXPORTACIÓN */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                      <h1 style={{ color: '#0f172a', fontSize: '2.2rem', margin: '0 0 5px 0', fontWeight: '800', letterSpacing: '-0.5px' }}>
                        Bitácora de Auditoría
                      </h1>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '1rem' }}>Registro histórico detallado de transacciones y seguridad</p>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={exportarBitacoraCSV}
                        style={{
                          padding: '10px 20px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none',
                          borderRadius: '8px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)', transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(16, 185, 129, 0.3)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(16, 185, 129, 0.2)'; }}
                      >
                        Exportar CSV
                      </button>
                      <button
                        onClick={exportarBitacoraPDF}
                        style={{
                          padding: '10px 20px', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', border: 'none',
                          borderRadius: '8px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)', transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(239, 68, 68, 0.3)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(239, 68, 68, 0.2)'; }}
                      >
                        Exportar PDF
                      </button>
                    </div>
                  </div>

                  {/* TABS DE NAVEGACIÓN ESTILO "PILL" */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    <button
                      onClick={() => { setTabBitacora('auth'); setFiltros({ usuario: '', rol: '', fecha: '', ticket: '' }); }}
                      style={{
                        padding: '12px 24px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem',
                        background: tabBitacora === 'auth' ? '#1e293b' : 'white',
                        color: tabBitacora === 'auth' ? 'white' : '#64748b',
                        border: tabBitacora === 'auth' ? 'none' : '1px solid #e2e8f0',
                        borderRadius: '30px', boxShadow: tabBitacora === 'auth' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '8px'
                      }}>
                      Accesos y Seguridad
                    </button>
                    <button
                      onClick={() => { setTabBitacora('quejas'); setFiltros({ usuario: '', rol: '', fecha: '', ticket: '' }); }}
                      style={{
                        padding: '12px 24px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem',
                        background: tabBitacora === 'quejas' ? '#1e293b' : 'white',
                        color: tabBitacora === 'quejas' ? 'white' : '#64748b',
                        border: tabBitacora === 'quejas' ? 'none' : '1px solid #e2e8f0',
                        borderRadius: '30px', boxShadow: tabBitacora === 'quejas' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '8px'
                      }}>
                      Trazabilidad de Quejas
                    </button>
                  </div>

                  {/* BARRA DE FILTROS FLOTANTE PREMIUM */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px',
                    marginBottom: '30px', background: 'white', padding: '24px', borderRadius: '16px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.02), 0 4px 6px -2px rgba(0,0,0,0.01)', border: '1px solid #f1f5f9'
                  }}>
                    {tabBitacora === 'quejas' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>N° de Ticket</label>
                        <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                          <input type="text" placeholder="Buscar..." value={filtros.ticket} onChange={(e) => setFiltros({ ...filtros, ticket: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: 'none', outline: 'none', fontSize: '0.95rem', background: 'transparent', color: '#0f172a' }} />
                        </div>
                      </div>
                    )}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Usuario o Email</label>
                      <input type="text" placeholder="Ej. jperez@banco.com" value={filtros.usuario} onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', background: '#f8fafc', color: '#0f172a', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#3b82f6'} onBlur={(e) => e.target.style.borderColor = '#e2e8f0'} />
                    </div>
                    {tabBitacora === 'auth' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rol del Sistema</label>
                        <input type="text" placeholder="Ej. ROLE_ADMIN" value={filtros.rol} onChange={(e) => setFiltros({ ...filtros, rol: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', background: '#f8fafc', color: '#0f172a' }} />
                      </div>
                    )}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fecha Específica</label>
                      <input type="date" value={filtros.fecha} onChange={(e) => setFiltros({ ...filtros, fecha: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', background: '#f8fafc', color: '#0f172a', fontFamily: 'inherit' }} />
                    </div>
                  </div>

                  {/* TABLA ULTRA PRO DE RESULTADOS */}
                  <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', textAlign: 'left', minWidth: '900px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            {tabBitacora === 'quejas' && <th style={{ padding: '18px 24px', color: '#475569', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' }}>Ticket Relacionado</th>}
                            <th style={{ padding: '18px 24px', color: '#475569', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' }}>Usuario</th>
                            <th style={{ padding: '18px 24px', color: '#475569', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' }}>Fecha y Hora</th>
                            {tabBitacora === 'auth' && <th style={{ padding: '18px 24px', color: '#475569', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' }}>Nivel de Acceso</th>}
                            <th style={{ padding: '18px 24px', color: '#475569', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' }}>Acción Auditada</th>
                            <th style={{ padding: '18px 24px', color: '#475569', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' }}>Origen (IP)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logsFiltrados.length === 0 ? (
                            <tr>
                              <td colSpan="6" style={{ padding: '60px 20px', textAlign: 'center' }}>
                                <h3 style={{ color: '#1e293b', margin: '0 0 10px 0' }}>Sin resultados</h3>
                                <p style={{ color: '#64748b', margin: 0 }}>No se encontraron registros en la bitácora con estos filtros.</p>
                              </td>
                            </tr>
                          ) : (
                            logsFiltrados.map((log, index) => {
                              // --- LÓGICA DE ESTILOS DINÁMICOS ---
                              const [fechaPart, horaPart] = log.fecha ? log.fecha.substring(0, 19).split('T') : ['Desconocido', ''];

                              const inicial = log.usuario ? log.usuario.charAt(0).toUpperCase() : '?';
                              const coloresAvatares = ['linear-gradient(135deg, #3b82f6, #2563eb)', 'linear-gradient(135deg, #8b5cf6, #7c3aed)', 'linear-gradient(135deg, #10b981, #059669)', 'linear-gradient(135deg, #f59e0b, #d97706)', 'linear-gradient(135deg, #ec4899, #db2777)'];
                              const colorAvatar = coloresAvatares[log.usuario ? log.usuario.charCodeAt(0) % coloresAvatares.length : 0];

                              const descLower = log.descripcion ? log.descripcion.toLowerCase() : '';
                              let badgeAccion = { bg: '#f1f5f9', text: '#475569' };

                              if (descLower.includes('inició') || descLower.includes('cre') || descLower.includes('aprob')) {
                                badgeAccion = { bg: '#dcfce7', text: '#15803d' };
                              } else if (descLower.includes('fall') || descLower.includes('error') || descLower.includes('deneg') || descLower.includes('elimin')) {
                                badgeAccion = { bg: '#fee2e2', text: '#b91c1c' };
                              } else if (descLower.includes('actualiz') || descLower.includes('modific') || descLower.includes('cambi')) {
                                badgeAccion = { bg: '#e0f2fe', text: '#0369a1' };
                              } else if (descLower.includes('asign') || descLower.includes('proces')) {
                                badgeAccion = { bg: '#fef3c7', text: '#b45309' };
                              }

                              // LÓGICA DE DETECCIÓN DE TICKET FALL LOUDLY
                              // Busca todas las combinaciones posibles. Si ninguna existe, lanza la advertencia visual.
                              const ticketValidado = log.numeroTicket || log.numero_ticket || log.ticket;

                              return (
                                <tr
                                  key={index}
                                  style={{ transition: 'all 0.2s ease', borderBottom: '1px solid #f1f5f9', backgroundColor: 'white' }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f8fafc';
                                    e.currentTarget.style.transform = 'scale(1.002)';
                                    e.currentTarget.style.boxShadow = 'inset 4px 0 0 0 #3b82f6';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'white';
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.boxShadow = 'none';
                                  }}
                                >
                                  {/* CELDA DEL TICKET INTELIGENTE */}
                                  {tabBitacora === 'quejas' && (
                                    <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                                      {ticketValidado ? (
                                        <span style={{ fontWeight: '800', color: '#0ea5e9', background: '#e0f2fe', padding: '6px 12px', borderRadius: '8px', border: '1px solid #bae6fd', letterSpacing: '0.5px', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                                          {ticketValidado}
                                        </span>
                                      ) : (
                                        <span style={{ fontWeight: '800', color: '#b91c1c', background: '#fee2e2', padding: '6px 12px', borderRadius: '8px', border: '1px solid #fca5a5', fontSize: '0.85rem' }}>
                                          ERROR: Falta numeroTicket en JSON (ID:{log.id})
                                        </span>
                                      )}
                                    </td>
                                  )}

                                  {/* USUARIO */}
                                  <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: colorAvatar, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1rem', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                        {inicial}
                                      </div>
                                      <div>
                                        <p style={{ margin: 0, fontWeight: '700', color: '#1e293b', fontSize: '0.95rem' }}>{log.usuario}</p>
                                        {tabBitacora === 'quejas' && log.rol && log.rol !== 'N/A' && (
                                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{log.rol}</p>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* FECHA APILADA */}
                                  <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontWeight: '700', color: '#334155', fontSize: '0.9rem' }}>{fechaPart}</span>
                                      <span style={{ color: '#64748b', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                        {horaPart}
                                      </span>
                                    </div>
                                  </td>

                                  {/* ROL */}
                                  {tabBitacora === 'auth' && (
                                    <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #cbd5e1', color: '#475569', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.5px', background: 'white' }}>
                                        {log.rol}
                                      </span>
                                    </td>
                                  )}

                                  {/* ACCIÓN COMPACTA */}
                                  <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ maxWidth: '280px', whiteSpace: 'normal', lineHeight: '1.4' }}>
                                      <span style={{ background: badgeAccion.bg, color: badgeAccion.text, padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', display: 'inline-flex', alignItems: 'flex-start', gap: '6px', border: `1px solid ${badgeAccion.text}20`, wordBreak: 'break-word' }}>
                                        <span>{log.descripcion}</span>
                                      </span>
                                    </div>
                                  </td>

                                  {/* IP */}
                                  <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontFamily: '"Fira Code", "Courier New", monospace', background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', color: '#475569', border: '1px solid #e2e8f0', fontWeight: '600' }}>
                                        {log.ip}
                                      </span>
                                    </div>
                                  </td>

                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* FOOTER DE TABLA */}
                    {logsFiltrados.length > 0 && (
                      <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600' }}>Mostrando <strong style={{ color: '#0f172a' }}>{logsFiltrados.length}</strong> registros encontrados</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button disabled style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed', fontWeight: 'bold' }}>Anterior</button>
                          <button disabled style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed', fontWeight: 'bold' }}>Siguiente</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        </main>
      </div>
    </div>
  );
}

export default PortalAdmin;