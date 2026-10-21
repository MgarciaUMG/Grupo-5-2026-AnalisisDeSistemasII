import { useState } from 'react';

function RegistrarQueja() {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [productoId, setProductoId] = useState('');
  const [archivo, setArchivo] = useState(null);

  // --- NUEVOS ESTADOS ---
  const [estaRelacionada, setEstaRelacionada] = useState(false);
  const [ticketPadre, setTicketPadre] = useState('');

  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
  const [cargando, setCargando] = useState(false);

  // Catálogo de productos basado en las reglas de negocio
  const catalogoProductos = [
    { id: 1, nombre: 'Cuentas de ahorro' },
    { id: 2, nombre: 'Tarjeta de crédito y debito' },
    { id: 3, nombre: 'Cuentas monetarias' },
    { id: 4, nombre: 'Prestamos' },
    { id: 5, nombre: 'Cheques' }
  ];

  const manejarCambioArchivo = (e) => {
    setMensaje({ texto: '', tipo: '' }); // Limpiamos errores previos
    const file = e.target.files[0];

    if (file) {
      // Validación 1: Formato permitido (PDF o JPEG)
      const formatosPermitidos = ['application/pdf', 'image/jpeg'];
      if (!formatosPermitidos.includes(file.type)) {
        setMensaje({ texto: 'Error: El formato del archivo debe ser PDF o JPEG.', tipo: 'error' });
        e.target.value = ''; // Resetea el input
        setArchivo(null);
        return;
      }

      // Validación 2: Tamaño máximo de 2 MB (2 * 1024 * 1024 bytes)
      const tamanoMaximo = 2 * 1024 * 1024;
      if (file.size > tamanoMaximo) {
        setMensaje({ texto: 'Error: El archivo no debe superar los 2 MB de tamaño.', tipo: 'error' });
        e.target.value = ''; // Resetea el input
        setArchivo(null);
        return;
      }

      setArchivo(file);
    } else {
      setArchivo(null);
    }
  };

  const manejarSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setMensaje({ texto: 'Procesando solicitud y enviando datos...', tipo: 'info' });

    // Extracción segura del token como string
    let tokenString = localStorage.getItem('token');

    // Validamos si el token se guardó por error como un objeto JSON stringificado
    if (tokenString && tokenString.startsWith('{')) {
      try {
        const tokenObj = JSON.parse(tokenString);
        tokenString = tokenObj.token || tokenString;
      } catch (err) {
        console.warn('El token no es un JSON válido, procediendo con string crudo.');
      }
    }

    if (!tokenString) {
      setMensaje({ texto: 'Error de autenticación. Por favor, inicie sesión nuevamente.', tipo: 'error' });
      setCargando(false);
      return;
    }

    // Instanciamos FormData nativo para manejar el multipart/form-data
    const formData = new FormData();
    formData.append('titulo', titulo);
    formData.append('descripcion', descripcion);
    formData.append('productoId', productoId);

    const usuarioNombre = localStorage.getItem('nombreCliente') || '';
    const usuarioApellido = localStorage.getItem('apellidoCliente') || '';

    formData.append('usuarioNombre', usuarioNombre);
    formData.append('usuarioApellido', usuarioApellido);

    // --- AGREGAMOS EL TICKET PADRE SI APLICA ---
    if (estaRelacionada && ticketPadre) {
      formData.append('ticketPadre', ticketPadre.trim());
    }

    if (archivo) {
      formData.append('archivo', archivo);
    }

    try {
      const respuesta = await fetch('/api/quejas', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenString}`
          // Se omite Content-Type intencionalmente para que el navegador configure el 'boundary'
        },
        body: formData
      });

      if (respuesta.ok) {
        // Intentamos extraer el ID o mensaje del backend si responde con JSON o Texto
        const data = await respuesta.text();

        // ${data ? 'Ref: ' + data : ''}
        setMensaje({
          texto: `Queja Registrada con éxito.`,
          tipo: 'exito'
        });

        // Limpiamos el formulario
        setTitulo('');
        setDescripcion('');
        setProductoId('');
        setArchivo(null);
        setEstaRelacionada(false);
        setTicketPadre('');
        document.getElementById('input-archivo').value = '';

      } else {
        const errorText = await respuesta.text();
        setMensaje({ texto: ` ${errorText || 'No se pudo registrar la queja.'}`, tipo: 'error' });
      }
    } catch (error) {
      console.error('Error de conexión:', error);
      setMensaje({ texto: 'Error de red. Verifique su conexión al API Gateway.', tipo: 'error' });
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="content-card fade-in">
      <h2 className="card-title" style={{ color: '#0f172a', marginBottom: '8px' }}>Registrar una nueva queja</h2>
      <p className="card-text" style={{ color: '#64748b', marginBottom: '30px' }}>
        Complete los datos a continuación detallando los hechos. Su queja será enrutada al departamento correspondiente.
      </p>

      <form onSubmit={manejarSubmit}>

        {/* TÍTULO */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px', color: '#334155' }}>
            Título de la Queja *
          </label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={50}
            placeholder="Asunto breve de su inconveniente"
            required
            style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', boxSizing: 'border-box' }}
          />
          {/* Contador de caracteres para Título */}
          <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            Quedan {50 - titulo.length} de 50 caracteres disponibles
          </div>
        </div>

        {/* SELECTOR DE PRODUCTOS */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px', color: '#334155' }}>
            Producto Relacionado *
          </label>
          <select
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            required
            style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', boxSizing: 'border-box', color: '#334155' }}
          >
            <option value="" disabled>-- Seleccione un producto del catálogo --</option>
            {catalogoProductos.map((prod) => (
              <option key={prod.id} value={prod.id}>
                {prod.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* --- NUEVA SECCIÓN: TICKET RELACIONADO --- */}
        <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: '#0369a1', cursor: 'pointer', fontWeight: '500' }}>
            <input
              type="checkbox"
              checked={estaRelacionada}
              onChange={(e) => {
                setEstaRelacionada(e.target.checked);
                if (!e.target.checked) setTicketPadre(''); // Limpia el input si se desmarca
              }}
            />
            ¿Esta queja está relacionada con una Queja anterior?
          </label>

          {estaRelacionada && (
            <div style={{ marginTop: '12px' }} className="fade-in">
              <input
                type="text"
                value={ticketPadre}
                maxLength={15}
                onChange={(e) => setTicketPadre(e.target.value)}
                placeholder="Ingrese el número de Queja (Ej. QJ-12345)"
                required={estaRelacionada}
                style={{ width: '100%', padding: '10px', background: 'white', border: '1px solid #7dd3fc', borderRadius: '4px', boxSizing: 'border-box' }}
              />
              {/* Contador de caracteres para Ticket Padre */}
              <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#0369a1', marginTop: '4px' }}>
                Quedan {15 - ticketPadre.length} de 15 caracteres disponibles
              </div>
            </div>
          )}
        </div>

        {/* DESCRIPCIÓN */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px', color: '#334155' }}>
            Descripción de los Hechos *
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={120}
            placeholder="Detalle de forma clara el incidente reportado..."
            required
            rows="5"
            style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
          ></textarea>
          {/* Contador de caracteres para Descripción */}
          <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            Quedan {120 - descripcion.length} de 120 caracteres disponibles
          </div>
        </div>

        {/* CARGA DE ARCHIVOS */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px', color: '#334155' }}>
            Documentación de Respaldo (Opcional)
          </label>
          <input
            id="input-archivo"
            type="file"
            accept="image/jpeg, application/pdf"
            onChange={manejarCambioArchivo}
            style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px dashed #cbd5e1', borderRadius: '6px', cursor: 'pointer', boxSizing: 'border-box' }}
          />
          <small style={{ display: 'block', marginTop: '6px', color: '#94a3b8', fontSize: '0.8rem' }}>
            Formatos válidos: PDF o JPEG. Tamaño máximo: 2 MB.
          </small>
        </div>

        {/* BOTÓN DE ENVÍO */}
        <button
          type="submit"
          disabled={cargando}
          style={{
            marginTop: '10px',
            padding: '12px 24px',
            backgroundColor: cargando ? '#94a3b8' : '#00a8ff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            cursor: cargando ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
            width: '100%'
          }}
        >
          {cargando ? 'Registrando en el sistema...' : 'Enviar Queja'}
        </button>
      </form>

      {/* MENSAJES DE ESTADO */}
      {mensaje.texto && (
        <div style={{
          marginTop: '25px', padding: '14px', borderRadius: '6px', textAlign: 'center', fontWeight: '500', fontSize: '0.95rem',
          backgroundColor: mensaje.tipo === 'exito' ? '#f0fdf4' : mensaje.tipo === 'error' ? '#fef2f2' : '#f0f9ff',
          color: mensaje.tipo === 'exito' ? '#166534' : mensaje.tipo === 'error' ? '#991b1b' : '#0369a1',
          border: `1px solid ${mensaje.tipo === 'exito' ? '#bbf7d0' : mensaje.tipo === 'error' ? '#fecaca' : '#bae6fd'}`
        }}>
          {mensaje.texto}
        </div>
      )}
    </div>
  );
}

export default RegistrarQueja;