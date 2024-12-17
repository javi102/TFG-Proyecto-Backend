const express = require('express'); // Importa el framework Express para crear un servidor web en Node.js
const axios = require('axios');  // // Importa Axios para hacer solicitudes HTTP desde Node.js.
const db = require('./db');  // Conexión a la base de datos
const cors = require('cors'); // Importa CORS para permitir solicitudes desde otros dominios
const bodyParser = require('body-parser');  // Para manejar datos POST

const app = express();  // Crea una nueva instancia de Express

app.use(cors()); // Habilita CORS para permitir solicitudes desde otros dominios
app.use(bodyParser.json());  // Para procesar los datos en formato JSON

// ====================== Rutas de Autenticación ======================

// Ruta para registrar un nuevo usuario
app.post('/register', async (req, res) => { //el async es para que la funcion sea asincrona y pueda usar await.
  const { username, email, password } = req.body;  

  console.log("Datos recibidos en /register:", req.body);  // Verificar los datos de entrada

  try {
    // Verificar si el usuario ya existe
    const [existingUser] = await db.query('SELECT * FROM usuarios WHERE username = ?', [username]);
    //El await lo que hace es esperar una promesa que se resuelva, en este caso la promesa es la consulta a la base de datos.
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    // Si el usuario no existe, lo insertamos en la base de datos, incluyendo el campo `email`
    await db.query('INSERT INTO usuarios (username, email, password) VALUES (?, ?, ?)', [username, email, password]);
    res.status(201).json({ message: 'Usuario registrado exitosamente' });
  } catch (error) {
    console.error('Error al registrar el usuario:', error);
    res.status(500).json({ error: 'Error en el registro de usuario' });
  }
});

// Ruta para login de usuario
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Verificar si el usuario existe
    const [user] = await db.query('SELECT * FROM usuarios WHERE username = ? AND password = ?', [username, password]);

    if (user.length === 0) {
      return res.status(400).json({ message: 'Usuario o contraseña incorrectos' });
    }

    // Si el usuario existe y las credenciales coinciden
    res.json({ message: 'Inicio de sesión exitoso', user: user[0] });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ error: 'Error en el inicio de sesión' });
  }
});

// ====================== Rutas para Manejar Campeones ======================

// Ruta para importar los campeones desde el archivo JSON
app.get('/import-champions', async (req, res) => {
  try {
    // URL del JSON que contiene los datos de los campeones
    const url = 'https://ddragon.leagueoflegends.com/cdn/14.19.1/data/en_US/champion.json';

    // Obtener los datos del JSON
    const response = await axios.get(url);
    const championsData = response.data.data;  // Aquí están los campeones

    for (let championKey in championsData) {
      const champion = championsData[championKey];

      console.log(`Procesando campeón: ${champion.name}`);

      // Verificar si el campeón ya existe
      const [existingChampion] = await db.query('SELECT * FROM champions WHERE name = ?', [champion.name]);

      let championId;
      if (existingChampion.length > 0) {
        // Si el campeón ya existe, actualiza sus datos
        championId = existingChampion[0].id;
        await db.query(
          `UPDATE champions 
           SET title = ?,  role = ? 
           WHERE id = ?`,
          [champion.title,  champion.tags[0], championId]
        );
        console.log(`Campeón ${champion.name} actualizado. ID: ${championId}`);
      } else {
        // Si no existe, inserta el nuevo campeón
        const [insertResult] = await db.query(
          `INSERT INTO champions (name, title,  role) 
           VALUES (?, ?, ?)`,
          [champion.name, champion.title,  champion.tags[0]]
        );
        championId = insertResult.insertId; // Obtén el ID del nuevo campeón
        console.log(`Campeón ${champion.name} insertado. ID: ${championId}`);
      }

      // Insertar o actualizar las estadísticas del campeón
      const [existingStats] = await db.query('SELECT * FROM stats WHERE champion_id = ?', [championId]);

      if (existingStats.length > 0) {
        // Actualiza las estadísticas si ya existen
        await db.query(
          `UPDATE stats 
           SET health = ?, armor = ?, attack_damage = ?, speed = ? 
           WHERE champion_id = ?`,
          [
            champion.stats.hp,
            champion.stats.armor,
            champion.stats.attackdamage,
            champion.stats.movespeed,
            championId
          ]
        );
        console.log(`Estadísticas del campeón ${champion.name} actualizadas.`);
      } else {
        // Inserta nuevas estadísticas
        await db.query(
          `INSERT INTO stats (champion_id, health, armor, attack_damage, speed) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            championId,
            champion.stats.hp,
            champion.stats.armor,
            champion.stats.attackdamage,
            champion.stats.movespeed
          ]
        );
        console.log(`Estadísticas del campeón ${champion.name} insertadas.`);
      }
    }

    res.json({ message: 'Campeones importados correctamente' });
  } catch (error) {
    console.error('Error al importar los campeones:', error);
    res.status(500).json({ error: 'Error al importar los campeones' });
  }
});

// Ruta para obtener los campeones desde la base de datos
app.get('/champions', async (req, res) => {
  try {
    // Consulta para obtener todos los campeones con sus estadísticas
    const [champions] = await db.query(`
      SELECT 
        c.id, 
        c.name, 
        c.title, 
        c.role, 
        s.health, 
        s.armor, 
        s.attack_damage, 
        s.speed
      FROM champions c
      LEFT JOIN stats s ON c.id = s.champion_id
    `);

    // Devuelve los campeones con sus estadísticas en formato JSON
    res.json({ data: champions });
  } catch (error) {
    console.error('Error al obtener los campeones:', error);
    res.status(500).json({ error: 'Error al obtener los campeones' });
  }
});

// ====================== Ruta para Importar stats2 ======================

// Ruta para importar stats2 desde el archivo JSON
app.get('/import-stats2', async (req, res) => {
  try {
    // URL del JSON que contiene los datos de stats2
    const urlStats2 = "https://gist.githubusercontent.com/javi102/82c56e1ff61003bb58e67d46bc8d48f1/raw/70c9a6f2400f1444c72eba6c28b472a0ba26ef6a/League%2520of%2520legends%2520champions%2520info%25202024.json";

    // Obtener los datos de stats2
    const responseStats2 = await axios.get(urlStats2);
    const stats2Data = responseStats2.data; 

    console.log("Datos obtenidos del JSON:", stats2Data); // Verifica si se obtuvieron los datos correctos

    // Asegúrate de que stats2Data es un objeto
    for (let championKey in stats2Data) {
      const stats = stats2Data[championKey];

      console.log(`Procesando estadísticas para: ${championKey}`, stats); // Verifica los datos que intentas insertar

      // Verifica que los valores no sean undefined
      const name = stats.Name || null;
      const classes = stats.Classes || null;
      const difficulty = stats.Difficulty || null;
      const rangeType = stats['Range type'] || null;

      console.log(`Valores a insertar: ${name}, ${classes}, ${difficulty}, ${rangeType}`);

      // Inserta los datos en la tabla stats2
      await db.query(
        `INSERT INTO stats2 (Name, Classes, Difficulty, Range_type)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE Classes = ?, Difficulty = ?, Range_type = ?`,
        [
          name,
          classes,
          difficulty,
          rangeType,
          classes,
          difficulty,
          rangeType
        ]
      );

      console.log(`Estadísticas 2 insertadas para: ${championKey}`);
    }

    res.json({ message: 'Estadísticas importadas correctamente' });
  } catch (error) {
    console.error('Error al importar las estadísticas:', error);
    res.status(500).json({ error: 'Error al importar las estadísticas', details: error.message });
  }
});


// Ruta para obtener estadisticas2 desde la base de datos
app.get('/stats2', async (req, res) => {
  try {
    // Consulta para obtener todos los campeones
    const [stats2Data] = await db.query('SELECT * FROM stats2');
    res.json({ data: stats2Data });  // Devuelve los campeones en formato JSON
  } catch (error) {
    console.error('Error al obtener los campeones:', error);
    res.status(500).json({ error: 'Error al obtener los campeones' });
  }
});




// ====================== Rutas para Insertar Items ======================
app.get('/import-items', async (req, res) => {
  try {
    const url = 'https://gist.githubusercontent.com/javi102/c41403b32d0e37325634599ff2009af9/raw/a1a7f453206bed9d135da9c02c13f2a0e6750822/League%2520of%2520legends%2520Items';
    const response = await axios.get(url);
    const itemsData = response.data;

    for (let item of itemsData) {
      console.log(`Procesando ítem: ${item.name}, Imagen: ${item.image}`);

      const [existingItem] = await db.query('SELECT * FROM items WHERE name = ?', [item.name]);

      if (existingItem.length > 0) {
        await db.query(
          `UPDATE items 
           SET total = ?, image = ? 
           WHERE id = ?`,
          [
            item.total || 0,
            item.image || null,
            existingItem[0].id
          ]
        );
        console.log(`Ítem ${item.name} actualizado.`);
      } else {
        await db.query(
          `INSERT INTO items (name, total, image) 
           VALUES (?, ?, ?)`,
          [
            item.name,
            item.total || 0,
            item.image || null
          ]
        );
        console.log(`Ítem ${item.name} insertado.`);
      }
    }

    res.json({ message: 'Ítems importados correctamente' });
  } catch (error) {
    console.error('Error al importar los ítems:', error.message);
    res.status(500).json({ error: error.message || 'Error al importar los ítems' });
  }
});

// ====================== Rutas para obtener Items ======================
app.get('/items', async (req, res) => {
  try {
    // Consulta para obtener todos los ítems
    const [items] = await db.query('SELECT * FROM items');
    res.json({ data: items });  // Devuelve los ítems en formato JSON
  } catch (error) {
    console.error('Error al obtener los ítems:', error);
    res.status(500).json({ error: 'Error al obtener los ítems' });
  }
});




// ======================  Ruta para obtener la build ======================
app.get('/get-build', async (req, res) => {
  const { userId, championId } = req.query; // Parámetros opcionales para filtrar

  try {
    // Base de la consulta
    let query = `
      SELECT 
        b.id AS build_id,
        u.username AS user,
        c.name AS champion,
        c.title AS champion_title,
        i.name AS item_name,
        i.total AS item_price,
        i.image AS item_image
      FROM build_personalizada b
      INNER JOIN usuarios u ON b.user_id = u.id
      INNER JOIN champions c ON b.champion_id = c.id
      INNER JOIN items i ON b.item_id = i.id
    `;

    // Condiciones opcionales para filtrar
    const conditions = [];
    const params = [];

    // Agrega las condiciones si existen
    if (userId) {
      conditions.push('b.user_id = ?');
      params.push(userId);
    }
    
    // Agrega las condiciones si existen
    if (championId) {
      conditions.push('b.champion_id = ?');
      params.push(championId);
    }

    // Agregar las condiciones si existen
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Ejecutar la consulta
    const [builds] = await db.query(query, params);

    // Devuelve el resultado
    res.json({ data: builds });
  } catch (error) {
    console.error('Error al obtener las builds personalizadas:', error);
    res.status(500).json({ error: 'Error al obtener las builds personalizadas' });
  }
});

// ======================  Ruta para guardar la build ======================
app.post('/save-build', async (req, res) => {
  const { items, championId, userId } = req.body;

  console.log("Datos recibidos en /save-build:", req.body);  // Para verificar los datos

  try {
    // Guardar los ítems de la build para el campeón y el usuario
    for (let itemId of items) {
      await db.query(
        `INSERT INTO build_personalizada (champion_id, user_id, item_id) 
         VALUES (?, ?, ?)`,
        [championId, userId, itemId]
      );
    }

    res.status(201).json({ message: 'Build guardada correctamente' });
  } catch (error) {
    console.error('Error al guardar la build:', error);
    res.status(500).json({ error: 'Error al guardar la build' });
  }
});



// ====================== Ruta para los matchups ======================
app.post('/counter-matchups', async (req, res) => {
  const { campeon, winrate, numero_partidas, champion_id } = req.body; 

  try {
    // Insertar los datos de un campeón y su matchup con champion_id
    const [result] = await db.query(
      `INSERT INTO counter_matchups (campeon, winrate, numero_partidas, champion_id) 
      VALUES (?, ?, ?, ?)`,
      [campeon, winrate, numero_partidas, champion_id]
    );
    
    res.status(201).json({ message: 'Datos de counter-matchup guardados correctamente', data: result });
  } catch (error) {
    console.error('Error al guardar los datos de counter-matchup:', error);
    res.status(500).json({ error: 'Error al guardar los datos de counter-matchup' });
  }
});


app.get('/counter-matchups', async (req, res) => {
  try {
    // Obtiene todos los datos de la tabla counter_matchups
    const [matchups] = await db.query('SELECT * FROM counter_matchups');
    res.json({ data: matchups });
  } catch (error) {
    console.error('Error al obtener los datos de counter-matchup:', error);
    res.status(500).json({ error: 'Error al obtener los datos de counter-matchup' });
  }
});



// ======================  matchups ======================

app.post('/matchups', async (req, res) => {
  const { campeon, winrate, numero_partidas, champion_id } = req.body; 

  try {
    // Insertar los datos de un campeón y su matchup con champion_id
    const [result] = await db.query(
      `INSERT INTO matchup (campeon, winrate, numero_partidas, champion_id) 
      VALUES (?, ?, ?, ?)`,
      [campeon, winrate, numero_partidas, champion_id]
    );
    
    res.status(201).json({ message: 'Datos de matchup guardados correctamente', data: result });
  } catch (error) {
    console.error('Error al guardar los datos de matchup:', error);
    res.status(500).json({ error: 'Error al guardar los datos de matchup' });
  }
});



app.get('/matchups', async (req, res) => {
  try {
    // Obtener todos los datos de la tabla matchup
    const [matchups] = await db.query('SELECT * FROM matchup');
    res.json({ data: matchups });
  } catch (error) {
    console.error('Error al obtener los datos de matchup:', error);
    res.status(500).json({ error: 'Error al obtener los datos de matchup' });
  }
});






// ======================  good matchups ======================

app.post('/good-matchups', async (req, res) => {
  const { campeon, winrate, numero_partidas, champion_id } = req.body; 

  try {
    // Insertar los datos de un campeón y su good matchup con champion_id
    const [result] = await db.query(
      `INSERT INTO goodMatchup (campeon, winrate, numero_partidas, champion_id) 
      VALUES (?, ?, ?, ?)`,
      [campeon, winrate, numero_partidas, champion_id]
    );
    
    res.status(201).json({ message: 'Datos de good-matchup guardados correctamente', data: result });
  } catch (error) {
    console.error('Error al guardar los datos de good-matchup:', error);
    res.status(500).json({ error: 'Error al guardar los datos de good-matchup' });
  }
});



app.get('/good-matchups', async (req, res) => {
  try {
    // Obtener todos los datos de la tabla goodMatchup
    const [matchups] = await db.query('SELECT * FROM goodMatchup');
    res.json({ data: matchups });
  } catch (error) {
    console.error('Error al obtener los datos de good-matchup:', error);
    res.status(500).json({ error: 'Error al obtener los datos de good-matchup' });
  }
});







// ======================INSERCION DE COREITEMS======================
app.post('/save-core-items', async (req, res) => {
  const { champion_id, item1, item2, item3, pickRate, games, winRate } = req.body;

  try {
    // Inserta los datos en la tabla CoreItems
    await db.query(
      `INSERT INTO CoreItems (champion_id, item1, item2, item3, pickRate, games, winRate) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [champion_id, item1, item2, item3, pickRate, games, winRate]
    );

    res.status(201).json({ message: 'CoreItems guardados correctamente' });
  } catch (error) {
    console.error('Error al guardar CoreItems:', error);
    res.status(500).json({ error: 'Error al guardar CoreItems' });
  }
});


app.get('/core-items', async (req, res) => {
  try {
    // Consulta para obtener los CoreItems, con los nombres de los campeones y los ítems
    const [coreItems] = await db.query(`
      SELECT 
        ci.id, 
        c.name AS champion_name, 
        i1.name AS item1_name,
        i2.name AS item2_name,
        i3.name AS item3_name,
        ci.pickRate, 
        ci.games, 
        ci.winRate
      FROM CoreItems ci
      JOIN champions c ON ci.champion_id = c.id
      LEFT JOIN items i1 ON ci.item1 = i1.id
      LEFT JOIN items i2 ON ci.item2 = i2.id
      LEFT JOIN items i3 ON ci.item3 = i3.id
    `);

    // Devuelve los CoreItems con los datos de los campeones e ítems
    res.json({ data: coreItems });
  } catch (error) {
    console.error('Error al obtener los CoreItems:', error);
    res.status(500).json({ error: 'Error al obtener los CoreItems' });
  }
});



// ======================  Ruta para obtener los objetos ======================


// Ruta para guardar los datos en la tabla Objetos
app.post('/save-objetos', async (req, res) => {
  const { champion_id, item, pickRate, games, winRate } = req.body; //el req.body es para obtener los datos que se envian en el body de la peticion

  console.log("Datos recibidos en /save-objetos:", req.body);  

  try {
    // Inserta los datos en la tabla Objetos
    await db.query(
      `INSERT INTO ObjetosBuilds (champion_id, item, pickRate, games, winRate) 
       VALUES (?, ?, ?, ?, ?)`,
      [champion_id, item, pickRate, games, winRate]
    );

    res.status(201).json({ message: 'Objeto guardado correctamente' });
  } catch (error) {
    console.error('Error al guardar el objeto:', error);
    res.status(500).json({ error: 'Error al guardar el objeto' });
  }
});


// Ruta para obtener todos los objetos
app.get('/objetos', async (req, res) => {
  try {
    // Consulta para obtener los objetos, uniendo con las tablas de campeones e ítems
    const [objetos] = await db.query(`
      SELECT 
        o.id, 
        c.name AS champion_name, 
        i.name AS item_name, 
        o.pickRate, 
        o.games, 
        o.winRate
      FROM ObjetosBuilds o
      JOIN champions c ON o.champion_id = c.id
      JOIN items i ON o.item = i.id
    `);

    // Devuelve los objetos en formato JSON
    res.json({ data: objetos });
  } catch (error) {
    console.error('Error al obtener los objetos:', error);
    res.status(500).json({ error: 'Error al obtener los objetos' });
  }
});



// ======================STARTER ITEMS ======================

app.post('/save-starter-items', async (req, res) => {
  const { champion_id, item1, item2, item3, pickRate, games, winRate } = req.body;

  try {
    // Inserta los datos en la tabla StarterItems
    await db.query(
      `INSERT INTO StarterItems (champion_id, item1, item2, item3, pickRate, games, winRate) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [champion_id, item1, item2, item3, pickRate, games, winRate]
    );

    res.status(201).json({ message: 'StarterItems guardados correctamente' });
  } catch (error) {
    console.error('Error al guardar StarterItems:', error);
    res.status(500).json({ error: 'Error al guardar StarterItems' });
  }
});


app.get('/starter-items', async (req, res) => {
  try {
    // Consulta para obtener los StarterItems, con los nombres de los campeones y los ítems
    const [starterItems] = await db.query(`
      SELECT 
        si.id, 
        c.name AS champion_name, 
        i1.name AS item1_name,
        i2.name AS item2_name,
        i3.name AS item3_name,
        si.pickRate, 
        si.games, 
        si.winRate
      FROM StarterItems si
      JOIN champions c ON si.champion_id = c.id
      LEFT JOIN items i1 ON si.item1 = i1.id
      LEFT JOIN items i2 ON si.item2 = i2.id
      LEFT JOIN items i3 ON si.item3 = i3.id
    `);

    // Devuelve los StarterItems con los datos de los campeones e ítems
    res.json({ data: starterItems });
  } catch (error) {
    console.error('Error al obtener los StarterItems:', error);
    res.status(500).json({ error: 'Error al obtener los StarterItems' });
  }
});



//  ======================BOTAS ======================

app.post('/save-botas', async (req, res) => {
  const { champion_id, item, pickRate, games, winRate } = req.body;

  console.log("Datos recibidos en /save-objetos-v2:", req.body);  

  try {
    // Insertar los datos en la tabla ObjetosV2
    await db.query(
      `INSERT INTO boots (champion_id, item, pickRate, games, winRate) 
       VALUES (?, ?, ?, ?, ?)`,
      [champion_id, item, pickRate, games, winRate]
    );

    res.status(201).json({ message: 'Objeto guardado correctamente en boots' });
  } catch (error) {
    console.error('Error al guardar el objeto en boots:', error);
    res.status(500).json({ error: 'Error al guardar el objeto' });
  }
});



app.get('/botas', async (req, res) => {
  try {
    // Consulta para obtener los objetos, uniendo con las tablas de campeones e ítems
    const [objetos] = await db.query(`
      SELECT 
        o.id, 
        c.name AS champion_name, 
        i.name AS item_name, 
        o.pickRate, 
        o.games, 
        o.winRate
      FROM boots o
      JOIN champions c ON o.champion_id = c.id
      JOIN items i ON o.item = i.id
    `);

    // Devuelve los objetos en formato JSON
    res.json({ data: objetos });
  } catch (error) {
    console.error('Error al obtener los objetos desde boots:', error);
    res.status(500).json({ error: 'Error al obtener los objetos' });
  }
});



// Inicia el servidor
app.listen(3000, () => {
  console.log('Servidor escuchando en el puerto 3000');
});
