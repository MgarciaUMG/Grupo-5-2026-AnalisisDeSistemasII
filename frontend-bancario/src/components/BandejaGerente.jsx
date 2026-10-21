import { useState, useEffect } from 'react';
import HistorialMensajes from './HistorialMensajes';

function BandejaGerente({ onLogout }) {
    const [quejas, setQuejas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);

    const [detalleActivo, setDetalleActivo] = useState(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);

    const [observaciones, setObservaciones] = useState('');
    const [mensajeAccion, setMensajeAccion] = useState({ texto: '', tipo: '' });
    const [procesandoAccion, setProcesandoAccion] = useState(false);
    const [accionCompletada, setAccionCompletada] = useState(false);

    const [refreshHistorial, setRefreshHistorial] = useState(0);
    const [mostrarSidebar, setMostrarSidebar] = useState(false);
    const [vistaActiva, setVistaActiva] = useState('inicio');

    const obtenerToken = () => {
        let tokenString = localStorage.getItem('token');
        if (tokenString && tokenString.startsWith('{')) {
            try {
                const tokenObj = JSON.parse(tokenString);
                return tokenObj.token || tokenString;
            } catch (err) { return tokenString; }
        }
        return tokenString;
    };

    const formatearFecha = (fecha) => {
        if (!fecha) return '-';

        const fechaObj = new Date(fecha);

        if (isNaN(fechaObj.getTime())) return '-';

        return fechaObj.toLocaleString('es-GT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const obtenerTextoCampo = (campo) => {
        if (!campo) return '';
        if (typeof campo === 'object' && campo.nombre) return campo.nombre;
        return String(campo);
    };

    useEffect(() => {
        cargarDashboard();
    }, []);

    const cargarDashboard = async () => {
        setCargando(true);
        setError(null);
        const token = obtenerToken();

        try {
            // 1. Estadísticas / Bienvenida
            try {
                const resStats = await fetch('/api/quejas/gerente/estadisticas', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (resStats.ok) {
                    const dataStats = await resStats.json();
                    setEstadisticasTexto(dataStats.mensajeBienvenida || dataStats.mensaje || 'Bienvenido a la Gerencia General.');
                }
            } catch (e) {
                console.warn("No se pudieron cargar las estadísticas", e);
            }

            // 2. Listado de Pendientes para el Gerente
            const resLista = await fetch('/api/quejas/gerente/pendientes', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (resLista.ok) {
                const dataLista = await resLista.json();
                setQuejas(Array.isArray(dataLista) ? dataLista : []);
            } else {
                setError('No se pudo obtener la bandeja de gerencia.');
                setQuejas([]);
            }
        } catch (err) {
            console.error('Error:', err);
            setError('Error de conexión con el servidor.');
            setQuejas([]);
        } finally {
            setCargando(false);
        }
    };

    const verDetalle = async (numeroTicket) => {
        setCargandoDetalle(true);
        setError(null);
        setObservaciones('');
        setMensajeAccion({ texto: '', tipo: '' });
        setAccionCompletada(false);

        const token = obtenerToken();

        try {
            const respuesta = await fetch(`/api/quejas/${numeroTicket}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (respuesta.ok) {
                const data = await respuesta.json();
                setDetalleActivo(data);
            } else {
                setError('No se pudieron cargar los detalles del ticket.');
            }
        } catch (err) {
            console.error('Error:', err);
            setError('Error de conexión al intentar obtener los detalles.');
        } finally {
            setCargandoDetalle(false);
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const evento = params.get('event');
        const ticketFirma = params.get('ticketFirma');

        if (evento === 'signing_complete' && ticketFirma) {
            setMensajeAccion({ texto: 'Firma exitosa. Generando PDF y enviando al cliente...', tipo: 'info' });

            const token = obtenerToken();

            // Llamamos al nuevo endpoint en el backend para enviar el correo
            fetch(`/api/quejas/${ticketFirma}/notificar-cliente`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => {
                    if (!res.ok) throw new Error('Error al notificar al cliente');
                    setMensajeAccion({ texto: '¡Dictamen firmado y enviado al correo del cliente exitosamente!', tipo: 'exito' });
                })
                .catch(err => {
                    console.error(err);
                    setMensajeAccion({ texto: 'Dictamen firmado, pero ocurrió un error al enviar el correo.', tipo: 'error' });
                })
                .finally(() => {
                    setAccionCompletada(true);
                    verDetalle(ticketFirma);
                    // Limpiamos la URL para evitar que se reenvíe el correo si el usuario actualiza la página
                    window.history.replaceState({}, document.title, window.location.pathname);
                });
        }
    }, []);

    const abrirDocumento = async (documentoId) => {
        const token = obtenerToken();
        try {
            const respuesta = await fetch(`/api/quejas/documento/${documentoId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!respuesta.ok) {
                alert('No fue posible descargar los documentos');
                return;
            }

            const blob = await respuesta.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            alert('No fue posible descargar los documentos');
        }
    };

    const verDictamenFirmado = async (numeroTicket) => {
        const token = obtenerToken();
        try {
            const respuesta = await fetch(`/api/quejas/${numeroTicket}/descargar-resolucion`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (respuesta.ok) {
                const blob = await respuesta.blob();
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } else if (respuesta.status === 404) {
                alert('Este ticket no tiene un dictamen firmado asociado.');
            } else {
                alert('Ocurrió un error al intentar descargar el dictamen firmado.');
            }
        } catch (error) {
            console.error('Error al descargar dictamen:', error);
            alert('Error de red. No fue posible conectar con el servidor.');
        }
    };

    const ejecutarAccionGerente = async (tipoAccion, numeroTicket) => {
        if (!observaciones.trim()) {
            setMensajeAccion({ texto: 'Debe ingresar sus observaciones antes de continuar.', tipo: 'error' });
            return;
        }

        setProcesandoAccion(true);
        setMensajeAccion({ texto: 'Procesando operación...', tipo: 'info' });
        const token = obtenerToken();

        // Endpoints correspondientes a la Gerencia
        const endpoint = tipoAccion === 'devolver'
            ? `/api/quejas/${numeroTicket}/gerente-devolver`
            : `/api/quejas/${numeroTicket}/gerente-procesar`;

        const payload = { observaciones: observaciones, nombreFirmante: nombreParaMostrar, accion: tipoAccion };

        try {
            const respuesta = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (respuesta.ok) {
                const data = await respuesta.json();

                // Redirección a DocuSign si el Gerente aprueba o deniega (ambas requieren firma)
                if (data.urlFirma) {
                    setMensajeAccion({ texto: 'Redirigiendo a DocuSign para firma final...', tipo: 'info' });
                    window.location.href = data.urlFirma;
                    return;
                }

                setMensajeAccion({ texto: data.mensaje || 'Operación realizada con éxito.', tipo: 'exito' });
                setObservaciones('');
                setAccionCompletada(true);

                const nuevoEstado = tipoAccion === 'devolver' ? 'DevueltaParaRevision' : 'Cerrada';
                setDetalleActivo(prev => ({
                    ...prev,
                    queja: { ...prev.queja, estado: nuevoEstado }
                }));

                setTimeout(() => {
                    setDetalleActivo(null);
                    cargarDashboard();
                }, 2500);

            } else {
                const errorMsg = await respuesta.text();
                let textoFinal = "Error al procesar la solicitud.";
                try {
                    const parsed = JSON.parse(errorMsg);
                    textoFinal = parsed.error || parsed.mensaje || errorMsg;
                } catch { textoFinal = errorMsg; }
                setMensajeAccion({ texto: textoFinal, tipo: 'error' });
            }
        } catch (error) {
            console.error('Error al procesar acción:', error);
            setMensajeAccion({ texto: 'Error de red. Verifique su conexión al servidor.', tipo: 'error' });
        } finally {
            setProcesandoAccion(false);
        }
    };

    const getColorEstado = (estadoTexto) => {
        const clave = estadoTexto ? String(estadoTexto).replace(/\s+/g, '') : '';
        const estados = {
            'EnDictamen': { bg: '#e0e7ff', text: '#3730a3' },
            'Aprobada': { bg: '#dcfce7', text: '#166534' },
            'Denegada': { bg: '#fef2f2', text: '#991b1b' }
        };
        return estados[clave] || { bg: '#f1f5f9', text: '#475569' };
    };

    const nombreUsuario = localStorage.getItem('nombreUsuario') || localStorage.getItem('nombreCliente') || '';
    const apellidoUsuario = localStorage.getItem('apellidoUsuario') || localStorage.getItem('apellidoCliente') || '';

    const nombreParaMostrar = nombreUsuario || apellidoUsuario
        ? `${nombreUsuario} ${apellidoUsuario}`.trim()
        : 'Gerente General';

    const iniciales = (nombreUsuario.charAt(0) + apellidoUsuario.charAt(0)).toUpperCase() || 'GG';

    // Cálculos de estadísticas para Gerencia
    const statsNuevas = quejas.filter(q => obtenerTextoCampo(q.estado).replace(/\s+/g, '') === 'EnDictamen').length;

    return (
        <div className="portal-layout">

            <aside className={`sidebar ${mostrarSidebar ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <div className="logo-circle-small">
                        <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'white', letterSpacing: '1px' }}>BCN</span>
                    </div>
                    <div className="brand-text">
                        <h2 style={{ fontSize: '15px' }}>Banco Capital Nacional</h2>
                        <p>PORTAL DE GERENCIA</p>
                    </div>
                </div>

                <div className="sidebar-menu-title" style={{ marginTop: '10px' }}>PANEL DE CONTROL</div>

                <ul className="nav-list">
                    <li className="nav-item">
                        <button
                            onClick={() => { setVistaActiva('inicio'); setDetalleActivo(null); }}
                            className={`nav-btn ${vistaActiva === 'inicio' ? 'active' : ''}`}
                        >
                            Inicio
                        </button>
                    </li>
                    <li className="nav-item">
                        <button
                            onClick={() => { setVistaActiva('pendientes'); setDetalleActivo(null); cargarDashboard(); }}
                            className={`nav-btn ${vistaActiva === 'pendientes' ? 'active' : ''}`}
                        >
                            Dictámenes Finales
                        </button>
                    </li>
                </ul>

                <div className="sidebar-footer">
                    <button onClick={onLogout} className="btn-logout">
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            <div className="main-wrapper">
                <header className="topbar" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', height: '100%' }}>
                        <button
                            onClick={() => setMostrarSidebar(!mostrarSidebar)}
                            style={{
                                background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', color: '#334155',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s',
                                transform: mostrarSidebar ? 'rotate(90deg)' : 'rotate(0deg)'
                            }}
                            title="Alternar Menú"
                        >
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    </div>

                    <div className="user-profile">
                        <div className="avatar" style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>
                            {iniciales}
                        </div>
                        <span style={{ textTransform: 'capitalize' }}>
                            {nombreParaMostrar}
                        </span>
                    </div>
                </header>

                <main className="content-area">

                    {detalleActivo && !cargandoDetalle ? (
                        <div className="content-card fade-in" style={{ maxWidth: '1000px', margin: '0 auto', backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                            {(() => {
                                const { queja, documentos } = detalleActivo;
                                const estadoTexto = obtenerTextoCampo(queja.estado) || 'EnDictamen';
                                const numeroTicketReal = obtenerTextoCampo(queja.numeroTicket);
                                const nombreCompleto = (queja.usuarioNombre || queja.usuarioApellido)
                                    ? `${queja.usuarioNombre || ''} ${queja.usuarioApellido || ''}`.trim()
                                    : (queja.clienteNombre || `Usuario ID: ${queja.idUsuario}`);

                                const estadoTicketLimpiado = estadoTexto.replace(/\s+/g, '');

                                const bloqueadoPorEstado = estadoTicketLimpiado !== 'EnDictamen';
                                const controlesBloqueados = procesandoAccion || accionCompletada || bloqueadoPorEstado;

                                return (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
                                            <h2 style={{ margin: 0, color: '#0f172a' }}>Resolución Final de Caso #{numeroTicketReal}</h2>
                                            <button
                                                onClick={() => { setDetalleActivo(null); setVistaActiva('pendientes'); cargarDashboard(); }}
                                                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                                            >
                                                ← Volver a la Bandeja
                                            </button>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                                            <div>
                                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 5px 0', fontWeight: '600' }}>DATOS DEL CLIENTE</p>
                                                <p style={{ margin: 0, color: '#1e293b', fontWeight: '900' }}>{'Nombre: ' + nombreCompleto}</p>
                                                <p style={{ margin: 0, color: '#1e293b', fontWeight: '900' }}>{'Correo: ' + queja.usuarioEmail}</p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 5px 0', fontWeight: '600' }}>ESTADO ACTUAL</p>
                                                <span style={{ background: getColorEstado(estadoTexto).bg, color: getColorEstado(estadoTexto).text, padding: '4px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600' }}>
                                                    {estadoTexto}
                                                </span>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 5px 0', fontWeight: '600' }}>FECHA DE REGISTRO</p>
                                                <p style={{ margin: 0, color: '#1e293b', fontWeight: '700' }}>
                                                    {formatearFecha(queja.fechaYHora || queja.fechaCreacion) !== '-'
                                                        ? formatearFecha(queja.fechaYHora || queja.fechaCreacion)
                                                        : 'No disponible'}
                                                </p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 5px 0', fontWeight: '600' }}>PRODUCTO RELACIONADO</p>
                                                <p style={{ margin: 0, color: '#1e293b', fontWeight: '900' }}>{obtenerTextoCampo(queja.producto)}</p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 5px 0', fontWeight: '600' }}>TÍTULO / ASUNTO</p>
                                                <p style={{ margin: 0, color: '#1e293b', fontWeight: '900' }}>{obtenerTextoCampo(queja.titulo)}</p>
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: '25px' }}>
                                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 5px 0', fontWeight: '600' }}>DESCRIPCIÓN DE LOS HECHOS</p>
                                            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#334155' }}>
                                                {obtenerTextoCampo(queja.descripcion)}
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: '30px' }}>
                                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 5px 0', fontWeight: '600' }}>DOCUMENTOS ADJUNTOS</p>
                                            {documentos && documentos.length > 0 ? (
                                                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                                                    {documentos.map((doc, index) => (
                                                        <li key={index} style={{ background: '#f8fafc', padding: '10px 15px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                            <span style={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: '500' }}>📄 {obtenerTextoCampo(doc.nombreOriginal || doc.nombreArchivo)}</span>
                                                            <button onClick={() => abrirDocumento(doc.id || doc.documentoId)} style={{ padding: '6px 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}>
                                                                Descargar Documento
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>Sin documentos de respaldo.</p>
                                            )}
                                        </div>

                                        <HistorialMensajes numeroTicket={numeroTicketReal} refreshTrigger={refreshHistorial} />

                                        <div style={{ borderTop: '2px dashed #cbd5e1', paddingTop: '20px', marginTop: '20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                                <h3 style={{ fontSize: '1.2rem', color: '#0f172a', margin: 0 }}>Firma y Comentarios de Gerencia</h3>
                                                <button
                                                    onClick={() => verDictamenFirmado(numeroTicketReal)}
                                                    style={{
                                                        padding: '8px 16px', background: '#10b981', color: 'white', border: 'none',
                                                        borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                                                    }}
                                                >
                                                    📄 Ver Dictamen Firmado
                                                </button>
                                            </div>

                                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 5px 0', fontWeight: '600' }}>OBSERVACIONES FINALES (Se imprimirán en el PDF de Resolución)</p>

                                            <textarea
                                                value={observaciones}
                                                onChange={(e) => setObservaciones(e.target.value)}
                                                placeholder={
                                                    bloqueadoPorEstado
                                                        ? `El ticket está en estado "${estadoTexto}". No se admiten nuevas justificaciones.`
                                                        : "Escriba los comentarios que justifican la aprobación o denegación..."
                                                }
                                                rows="4"
                                                maxLength={500}
                                                style={{
                                                    width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                                                    marginBottom: '5px', fontFamily: 'inherit', resize: 'vertical',
                                                    backgroundColor: controlesBloqueados ? '#f1f5f9' : 'white',
                                                    boxSizing: 'border-box'
                                                }}
                                                disabled={controlesBloqueados}
                                            ></textarea>

                                            {!controlesBloqueados && (
                                                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: observaciones.length === 500 ? '#ef4444' : '#94a3b8', marginBottom: '15px' }}>
                                                    {observaciones.length}/500 caracteres
                                                </div>
                                            )}

                                            {mensajeAccion.texto && (
                                                <div style={{
                                                    marginBottom: '15px', padding: '12px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: '500',
                                                    backgroundColor: mensajeAccion.tipo === 'error' ? '#fef2f2' : mensajeAccion.tipo === 'exito' ? '#f0fdf4' : '#f0f9ff',
                                                    color: mensajeAccion.tipo === 'error' ? '#991b1b' : mensajeAccion.tipo === 'exito' ? '#166534' : '#0369a1',
                                                    border: `1px solid ${mensajeAccion.tipo === 'error' ? '#fecaca' : mensajeAccion.tipo === 'exito' ? '#bbf7d0' : '#bae6fd'}`
                                                }}>
                                                    {mensajeAccion.texto}
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                                <button
                                                    onClick={() => ejecutarAccionGerente('devolver', numeroTicketReal)}
                                                    disabled={controlesBloqueados}
                                                    style={{ padding: '10px 20px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: controlesBloqueados ? 'not-allowed' : 'pointer', opacity: controlesBloqueados ? 0.6 : 1 }}
                                                >
                                                    Devolver al Agente
                                                </button>
                                                <button
                                                    onClick={() => ejecutarAccionGerente('denegar', numeroTicketReal)}
                                                    disabled={controlesBloqueados}
                                                    style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: controlesBloqueados ? 'not-allowed' : 'pointer', opacity: controlesBloqueados ? 0.6 : 1 }}
                                                >
                                                    Denegar y Firmar
                                                </button>
                                                <button
                                                    onClick={() => ejecutarAccionGerente('aprobar', numeroTicketReal)}
                                                    disabled={controlesBloqueados}
                                                    style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: controlesBloqueados ? 'not-allowed' : 'pointer', opacity: controlesBloqueados ? 0.6 : 1 }}
                                                >
                                                    Aprobar y Firmar
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                    ) : vistaActiva === 'inicio' ? (

                        <div className="fade-in">
                            <div className="content-header" style={{ marginBottom: '30px' }}>
                                <h1 style={{ fontSize: '2.2rem', color: '#0f172a', margin: '0 0 10px 0' }}>
                                    Hola, {nombreParaMostrar} bienvenido a su portal
                                </h1>
                                <p style={{ fontSize: '1.1rem', color: '#64748b', margin: 0 }}>
                                    Resumen de autorización y cierre de dictámenes escalados a Gerencia.
                                </p>
                            </div>


                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', borderLeft: '4px solid #0f172a', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                                    <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b', margin: '0 0 10px 0', textTransform: 'uppercase' }}>Trámites en Bandeja</p>
                                    <h3 style={{ fontSize: '2.2rem', color: '#0f172a', margin: 0 }}>{cargando ? '...' : quejas.length}</h3>
                                </div>
                                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', borderLeft: '4px solid #0ea5e9', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                                    <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b', margin: '0 0 10px 0', textTransform: 'uppercase' }}>Pendientes de Firma</p>
                                    <h3 style={{ fontSize: '2.2rem', color: '#0f172a', margin: 0 }}>{cargando ? '...' : statsNuevas}</h3>
                                </div>
                            </div>
                        </div>

                    ) : (

                        <div className="content-card fade-in" style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                            <h1 style={{ color: '#0f172a', fontSize: '1.8rem', marginTop: 0 }}>Dictámenes Listos para Firma</h1>
                            <p style={{ color: '#64748b', marginBottom: '30px' }}>Seleccione el trámite para lectura, aprobación o denegación final.</p>

                            {error && (
                                <div style={{ padding: '15px', backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '20px' }}>
                                    {error}
                                </div>
                            )}

                            {cargando ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Sincronizando con el servidor...</div>
                            ) : quejas.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#475569', fontWeight: '500' }}>
                                    No existen quejas en su bandeja actualmente
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                                <th style={{ padding: '15px', color: '#475569', fontWeight: '600' }}>No. Ticket</th>
                                                <th style={{ padding: '15px', color: '#475569', fontWeight: '600' }}>Título</th>
                                                <th style={{ padding: '15px', color: '#475569', fontWeight: '600' }}>Fecha</th>
                                                <th style={{ padding: '15px', color: '#475569', fontWeight: '600' }}>Estado</th>
                                                <th style={{ padding: '15px', textAlign: 'right', color: '#475569', fontWeight: '600' }}>Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {quejas.map((queja) => {
                                                const idTicket = obtenerTextoCampo(queja.numeroTicket) || queja.id;
                                                const estadoTexto = obtenerTextoCampo(queja.estado) || 'EnDictamen';



                                                return (
                                                    <tr key={idTicket} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '15px', color: '#64748b', fontWeight: '500' }}>#{idTicket}</td>
                                                        <td style={{ padding: '15px', color: '#1e293b', fontWeight: '500' }}>{obtenerTextoCampo(queja.titulo)}</td>
                                                        <td style={{ padding: '15px', color: '#64748b', fontWeight: '700' }}>
                                                            {formatearFecha(queja.fechaYHora || queja.fechaCreacion)}
                                                        </td>
                                                        <td style={{ padding: '15px' }}>
                                                            <span style={{ background: getColorEstado(estadoTexto).bg, color: getColorEstado(estadoTexto).text, padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>
                                                                {estadoTexto}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '15px', textAlign: 'right' }}>
                                                            <button
                                                                onClick={() => verDetalle(idTicket)}
                                                                style={{ padding: '6px 12px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                                                            >
                                                                Ver Detalle
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default BandejaGerente;