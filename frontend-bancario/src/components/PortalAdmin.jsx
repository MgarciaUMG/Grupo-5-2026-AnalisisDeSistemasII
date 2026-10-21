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

            {/* VISTA 2: USUARIOS */}
            {vistaActiva === 'usuarios' && (
              <div>
                <h1 style={{ color: '#0f172a', fontSize: '1.8rem', marginTop: 0 }}>Gestión de Usuarios</h1>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '15px' }}>Email</th>
                      <th style={{ padding: '15px' }}>Rol</th>
                      <th style={{ padding: '15px' }}>Estado</th>
                      <th style={{ padding: '15px', textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map(user => (
                      <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '15px' }}>{user.email}</td>
                        <td style={{ padding: '15px' }}>{user.rol}</td>
                        <td style={{ padding: '15px' }}>
                          <span style={{ color: user.activo ? 'green' : 'red', fontWeight: 'bold' }}>
                            {user.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={{ padding: '15px', textAlign: 'right' }}>
                          <button onClick={() => toggleEstadoUsuario(user.id)} style={{ padding: '6px 12px', background: user.activo ? '#ef4444' : '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            {user.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* VISTA 3: BITÁCORA */}
            {vistaActiva === 'bitacora' && (() => {
              const listaActiva = tabBitacora === 'auth' ? (logs.auth || []) : (logs.quejas || []);

              const logsFiltrados = listaActiva.filter(log => {
                const matchUsuario = log.usuario.toLowerCase().includes(filtros.usuario.toLowerCase());
                const matchRol = log.rol.toLowerCase().includes(filtros.rol.toLowerCase());
                const matchFecha = log.fecha.includes(filtros.fecha);
                const matchTicket = tabBitacora === 'quejas' ? log.id.toLowerCase().includes(filtros.ticket.toLowerCase()) : true;
                return matchUsuario && matchRol && matchFecha && matchTicket;
              });

              return (
                <div className="fade-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h1 style={{ color: '#0f172a', fontSize: '1.8rem', margin: 0 }}>Bitácora de Auditoría</h1>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={exportarBitacoraCSV} style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                        📊 Exportar CSV
                      </button>
                      <button onClick={exportarBitacoraPDF} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                        📄 Exportar PDF
                      </button>
                    </div>
                  </div>

                  {/* TABS DE NAVEGACIÓN */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
                    <button
                      onClick={() => { setTabBitacora('auth'); setFiltros({ usuario: '', rol: '', fecha: '', ticket: '' }); }}
                      style={{ padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer', background: tabBitacora === 'auth' ? '#0f172a' : 'transparent', color: tabBitacora === 'auth' ? 'white' : '#64748b', border: 'none', borderRadius: '6px' }}>
                      Bitácora de Accesos (Usuarios)
                    </button>
                    <button
                      onClick={() => { setTabBitacora('quejas'); setFiltros({ usuario: '', rol: '', fecha: '', ticket: '' }); }}
                      style={{ padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer', background: tabBitacora === 'quejas' ? '#0f172a' : 'transparent', color: tabBitacora === 'quejas' ? 'white' : '#64748b', border: 'none', borderRadius: '6px' }}>
                      Bitácora de Operaciones (Quejas)
                    </button>
                  </div>

                  {/* BARRA DE FILTROS DINÁMICA */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>

                    {/* Filtro Ticket (Solo visible en Quejas) */}
                    {tabBitacora === 'quejas' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', marginBottom: '5px' }}>N° de Ticket</label>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
                          <span style={{ padding: '8px 12px', background: '#e2e8f0', color: '#475569', fontWeight: 'bold', borderRight: '1px solid #cbd5e1' }}>QJ-</span>
                          <input
                            type="text"
                            placeholder="12345..."
                            value={filtros.ticket}
                            onChange={(e) => setFiltros({ ...filtros, ticket: e.target.value })}
                            style={{ width: '100%', padding: '8px', border: 'none', outline: 'none' }}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', marginBottom: '5px' }}>Filtrar por Usuario (Email)</label>
                      <input type="text" placeholder="Ej. jperez@banco.com" value={filtros.usuario} onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                    </div>

                    {/* Filtro Rol (Solo visible en Auth) */}
                    {tabBitacora === 'auth' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', marginBottom: '5px' }}>Filtrar por Rol</label>
                        <input type="text" placeholder="Ej. ROLE_AGENTE" value={filtros.rol} onChange={(e) => setFiltros({ ...filtros, rol: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', marginBottom: '5px' }}>Filtrar por Fecha</label>
                      <input type="date" value={filtros.fecha} onChange={(e) => setFiltros({ ...filtros, fecha: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  {/* TABLA DE RESULTADOS */}
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f1f5f9' }}>
                          {tabBitacora === 'quejas' && <th style={{ padding: '12px' }}>Ticket</th>}
                          <th style={{ padding: '12px' }}>Fecha y Hora</th>
                          <th style={{ padding: '12px' }}>Usuario</th>
                          {tabBitacora === 'auth' && <th style={{ padding: '12px' }}>Rol</th>}
                          <th style={{ padding: '12px' }}>Acción Registrada</th>
                          <th style={{ padding: '12px' }}>Dirección IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logsFiltrados.length === 0 ? (
                          <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No se encontraron registros que coincidan con la búsqueda.</td></tr>
                        ) : (
                          logsFiltrados.map((log, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              {tabBitacora === 'quejas' && <td style={{ padding: '12px', fontWeight: 'bold' }}>{log.id}</td>}
                              <td style={{ padding: '12px', color: '#475569' }}>{log.fecha.substring(0, 19).replace('T', ' ')}</td>
                              <td style={{ padding: '12px', fontWeight: '600', color: '#0ea5e9' }}>{log.usuario}</td>
                              {tabBitacora === 'auth' && <td style={{ padding: '12px' }}><span style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>{log.rol}</span></td>}
                              <td style={{ padding: '12px', color: '#334155' }}>{log.descripcion}</td>
                              <td style={{ padding: '12px', color: '#94a3b8', fontSize: '0.8rem' }}>{log.ip}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
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