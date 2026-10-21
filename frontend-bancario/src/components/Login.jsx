import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import imagenFondo from '../assets/banca1.png';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });

  // Estados para el Flujo Alterno FA05 (Cuenta Inactiva)
  const [cuentaInactiva, setCuentaInactiva] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [motivoActivacion, setMotivoActivacion] = useState('');
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);

  const navigate = useNavigate();

  const manejarSumbit = async (e) => {
    e.preventDefault();

    // ==========================================
    // VALIDACIONES DEL FRONTEND
    // ==========================================

    // Limpiar mensaje anterior
    setMensaje({ texto: '', tipo: '' });
    setCuentaInactiva(false);

    // Validar usuario vacío
    if (!email.trim()) {
      setMensaje({
        texto: 'El usuario es obligatorio.',
        tipo: 'error'
      });
      return;
    }

    // Validar contraseña vacía
    if (!password.trim()) {
      setMensaje({
        texto: 'La contraseña es obligatoria.',
        tipo: 'error'
      });
      return;
    }

    // Validar formato de correo
    const formatoCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formatoCorreo.test(email.trim())) {
      setMensaje({
        texto: 'Al usuario le falta el signo "@".',
        tipo: 'error'
      });
      return;
    }

    // ==========================================
    // AUTENTICACIÓN
    // ==========================================

    setMensaje({
      texto: 'Validando credenciales...',
      tipo: 'info'
    });

    try {
      const respuesta = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      });

      // ==========================================
      // LOGIN EXITOSO
      // ==========================================

      if (respuesta.ok) {
        const data = await respuesta.json();

        localStorage.setItem('token', data.token);
        localStorage.setItem('rol', data.rol);
        localStorage.setItem('nombreCliente', data.nombre);
        localStorage.setItem('apellidoCliente', data.apellido);

        const rolRecibido = data.rol
          ? String(data.rol).toUpperCase()
          : '';

        if (rolRecibido.includes('USUARIO')) {
          navigate('/portal-usuario');

        } else if (rolRecibido.includes('AGENTE')) {
          navigate('/bandeja-agente');

        } else if (rolRecibido.includes('ADMIN')) {
          navigate('/admin-dashboard');

        } else if (rolRecibido.includes('SUPERVISOR')) {
          navigate('/bandeja-supervisor');

        } else if (rolRecibido.includes('JEFE')) {
          navigate('/bandeja-jefe');

        } else if (rolRecibido.includes('GERENTE')) {
          navigate('/bandeja-gerente');

        } else {
          console.warn(
            'Rol recibido desde Spring Boot:',
            data.rol
          );

          setMensaje({
            texto: `Rol recibido (${data.rol}) no tiene un portal asignado aún.`,
            tipo: 'error'
          });
        }

        // ==========================================
        // ERROR DEL SERVIDOR
        // ==========================================

      } else if (respuesta.status >= 500) {

        setMensaje({
          texto: `El servidor no se encuentra disponible`,
          tipo: 'error'
        });

        // ==========================================
        // ERRORES 400, 401, 403
        // ==========================================

      } else {

        let errorData = {};

        try {
          const errorText = await respuesta.text();

          errorData = errorText
            ? JSON.parse(errorText)
            : {};

        } catch (err) {
          console.warn(
            'El backend devolvió un error que no es JSON.'
          );
        }

        // Cuenta inactiva
        if (errorData.error === 'CUENTA_INACTIVA') {

          setMensaje({
            texto: 'Su cuenta se encuentra inactiva.',
            tipo: 'error'
          });

          setCuentaInactiva(true);

          // Credenciales incorrectas
        } else {

          setMensaje({
            texto: 'Credenciales incorrectas o acceso denegado.',
            tipo: 'error'
          });
        }
      }

    } catch (error) {

      console.error('Error fatal de red:', error);

      setMensaje({
        texto: 'Error de red. No se pudo contactar al servidor.',
        tipo: 'error'
      });
    }
  };

  // ==========================================
  // SOLICITUD DE ACTIVACIÓN
  // ==========================================

  const enviarSolicitudActivacion = async (e) => {
    e.preventDefault();

    // Validación manual del motivo
    if (!motivoActivacion.trim()) {
      setMensaje({
        texto: 'Debe indicar el motivo de la solicitud de activación.',
        tipo: 'error'
      });
      return;
    }

    setEnviandoSolicitud(true);

    try {
      const respuesta = await fetch(
        '/api/auth/solicitar-activacion',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            usuario: email.trim(),
            motivo: motivoActivacion.trim()
          })
        }
      );

      if (respuesta.ok) {

        setMensaje({
          texto: 'Solicitud de activación enviada al administrador con éxito.',
          tipo: 'exito'
        });

        setMostrarModal(false);
        setCuentaInactiva(false);
        setMotivoActivacion('');

      } else {

        setMensaje({
          texto: 'Hubo un problema al enviar la solicitud. Intente más tarde.',
          tipo: 'error'
        });
      }

    } catch (error) {

      console.error('Error:', error);

      setMensaje({
        texto: 'Error de red al intentar enviar la solicitud.',
        tipo: 'error'
      });

    } finally {
      setEnviandoSolicitud(false);
    }
  };

  return (
    <div className="split-layout">

      <div
        className="hero-section"
        style={{
          backgroundImage: `url(${imagenFondo})`
        }}
      >
        <div className="hero-overlay"></div>

        <div className="hero-content">
          <h1>Bienvenido a Banco Capital Nacional</h1>

          <p>
            Por favor ingresa tus credenciales para acceder a tu cuenta.
          </p>
        </div>
      </div>

      <div className="form-section">

        <div className="form-container">

          <div className="brand-header">

            <div className="logo-circle">
              <span
                style={{
                  fontWeight: 'bold',
                  fontSize: '20px',
                  color: 'white',
                  letterSpacing: '1px'
                }}
              >
                BCN
              </span>
            </div>

            <div className="brand-text">
              <h2>Banco Capital Nacional</h2>
              <p>Sistema Bancario Digital</p>
            </div>

          </div>

          {/* ==========================================
              FORMULARIO LOGIN
              noValidate = desactiva validación nativa
          ========================================== */}

          <form
            onSubmit={manejarSumbit}
            noValidate
          >

            <div className="input-group">

              <label>Usuario *</label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@banco.com"
              />

            </div>

            <div className="input-group">

              <label>Contraseña *</label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />

            </div>

            <button
              type="submit"
              className="submit-btn"
            >
              Ingresar
            </button>

          </form>

          {/* ==========================================
              MENSAJES DEL SISTEMA
          ========================================== */}

          {mensaje.texto && (
            <div
              className="mensaje-sistema"
              style={{
                borderColor:
                  mensaje.tipo === 'error'
                    ? '#fecaca'
                    : mensaje.tipo === 'exito'
                      ? '#bbf7d0'
                      : 'var(--accent-blue)',

                color:
                  mensaje.tipo === 'error'
                    ? '#ef4444'
                    : mensaje.tipo === 'exito'
                      ? '#10b981'
                      : 'var(--accent-blue)',

                backgroundColor:
                  mensaje.tipo === 'error'
                    ? '#fef2f2'
                    : mensaje.tipo === 'exito'
                      ? '#f0fdf4'
                      : 'rgba(0, 168, 255, 0.1)'
              }}
            >
              {mensaje.texto}
            </div>
          )}

          {/* ==========================================
              BOTÓN CUENTA INACTIVA
          ========================================== */}

          {cuentaInactiva && (
            <div
              style={{
                marginTop: '15px',
                textAlign: 'center'
              }}
            >

              <button
                onClick={() => setMostrarModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Solicitar activación de la cuenta
              </button>

            </div>
          )}

        </div>
      </div>

      {/* ==========================================
          MODAL DE ACTIVACIÓN
      ========================================== */}

      {mostrarModal && (

        <div className="modal-overlay">

          <div className="modal-card">

            <h3
              style={{
                marginTop: 0,
                color: '#0f172a'
              }}
            >
              Solicitud de Activación
            </h3>

            <p
              style={{
                fontSize: '0.9rem',
                color: '#64748b',
                marginBottom: '20px'
              }}
            >
              Envíe una solicitud al administrador para habilitar
              su acceso al sistema.
            </p>

            <form
              onSubmit={enviarSolicitudActivacion}
              noValidate
            >

              <div className="input-group">

                <label>
                  Usuario (Correo Institucional)
                </label>

                <input
                  type="email"
                  value={email}
                  readOnly
                  style={{
                    backgroundColor: '#01284e',
                    cursor: 'not-allowed'
                  }}
                />

              </div>

              <div className="input-group">

                <label>
                  Motivo de activación *
                </label>

                <textarea
                  value={motivoActivacion}
                  onChange={(e) =>
                    setMotivoActivacion(e.target.value)
                  }
                  placeholder="Justifique su necesidad de acceso..."
                  rows="4"
                  style={{
                    width: '100%',
                    padding: '14px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-input)',
                    borderRadius: '4px',
                    color: 'var(--text-main)',
                    resize: 'vertical'
                  }}
                />

              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  marginTop: '20px'
                }}
              >

                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'transparent',
                    border: '1px solid #cbd5e1',
                    color: '#64748b',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={enviandoSolicitud}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'var(--accent-blue)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: enviandoSolicitud
                      ? 'not-allowed'
                      : 'pointer'
                  }}
                >
                  {enviandoSolicitud
                    ? 'Enviando...'
                    : 'Enviar solicitud'}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

export default Login;