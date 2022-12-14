
import React from "react";
import { FreeCamera, Vector3, HemisphericLight, MeshBuilder } from "@babylonjs/core";
import SceneComponent from "./SceneComponent"; // u



export default function Secene3 (){
    /* TODO
 * island mode
 * UI panel with params
 * optimize rendering (single mesh terrain?)
 */ 

const canvas = document.getElementById("renderCanvas") // Get the canvas element 
const engine = new BABYLON.Engine(canvas, true) // Generate the BABYLON 3D engine

////////////////////////////////////////////////////////////////////////////////
// CONFIGURATION

// Render
const renderConfig = {
	useSSAO: false
}

// Map
const mapConfig = {
	mapSize: 64,
	mapHeight: 0.5, // Height scaling factor
	mapSeaMinLevel: 2, // Sea is flat below this value
	mapValueRange: {
		height: 12,
		moisture: 5
	},
	mapNoise: {
		height: {
			stupidRandom: false,
			frequencyRatio: 0.66, // Noise base size
			frequency: undefined, // To be computed later
			harmonics: [0.5, 0.3, 0.2], // Amplitude of noise octaves 0, 1 and 2 (must sum up to 1)
		},
		moisture: {
			stupidRandom: false,
			frequencyRatio: 0.66, // Noise base size
			frequency: undefined, // To be computed later
			// harmonics: [0.5, 0.3, 0.2], // Amplitude of noise octaves 0, 1 and 2 (must sum up to 1)
			harmonics: [0.7, 0.2, 0.1], // Amplitude of noise octaves 0, 1 and 2 (must sum up to 1)
		}
	},
	mapPostprocess: {
		height: {
			revert: false,
			forceSea: false,
			forceSeaPower: 2,
			normalize: true, // Spread the whole height range
			islandMode: false, // All map borders are sea
		},
		moisture: {
			revert: false,
			forceSea: false,
			forceSeaPower: 2,
			normalize: true, // Spread the whole height range
			islandMode: false, // All map borders are sea
		}
	}
}

// Computed config vars
mapConfig.mapNoise.height.frequency = 
	mapConfig.mapNoise.height.frequencyRatio * mapConfig.mapSize
mapConfig.mapNoise.moisture.frequency = 
	mapConfig.mapNoise.moisture.frequencyRatio * mapConfig.mapSize

// Terrain
const terrain = {
	deepsea: { 				color: '#000088' }, // 0
	sea: { 						color: '#0000cc' }, // 1
	shore: { 					color: '#0000ff' }, // 2
	
	whitebeach: { 		color: '#ffff88' }, // 3
	beach: { 					color: '#eeee44' }, // 3
	swamp: { 					color: '#888800' }, // 3
	
	desert: { 	 			color: '#e8c789' }, // 4
	grass: { 					color: '#88cc00' }, // 4 & 5
	plain: { 					color: '#449900' }, // 4 & 5 & 6
	
	forest: { 				color: '#006600' }, // 5 & 6 & 7
	deepforest: { 		color: '#003300' }, // 6 & 7
	pineforest: {			color: '#194d30' }, // 6 & 7 & 8
	
	mountain: { 			color: '#aaaaaa' }, // 8
	highmountain: { 	color: '#666666' }, // 8
	
	scorched: {				color: '#ddddcc' },
	snow: { 					color: '#ffffff' }, // 10

	ice: { 						color: '#ccffff' } // 11
}

////////////////////////////////////////////////////////////////////////////////
// MAP

const Map = (config) => {
	
	const map = {
		heightMap: [],
		moistureMap: [],
		
		normalizeNoise: (val) => val / 2 + 0.5, // From [-1 1] to [0 1]

		mapGetRange (map) {
			let minValue = 10000
			let maxValue = -10000

			for (x = 0; x < config.mapSize; x++) {
				for (y = 0; y < config.mapSize; y++) {
					if (map[x][y] < minValue) {
						minValue = map[x][y] 
					} else if (map[x][y] > maxValue) {
						maxValue = map[x][y] 
					}
				}
			}

			return {
				min: minValue,
				max: maxValue
			}
		},

		mapLogRange (map, type) {
			const range = this.mapGetRange(map)
			console.log('MAP RANGE', type, 'min', range.min, 'max', range.max)
		},

		normalizeMap (map, targetRange) {
			const range = this.mapGetRange(map)

			for (x = 0; x < config.mapSize; x++) {
				for (y = 0; y < config.mapSize; y++) {
					const ratio = (map[x][y] - range.min) / (range.max - range.min)
					const newHeight = ratio * (targetRange - 1)
					map[x][y] = newHeight
				}
			}
		},

		mapDistance (a, b) {
			return Math.sqrt(
				Math.pow(Math.abs(a.x - b.x), 2) +
				Math.pow(Math.abs(a.y - b.y), 2)
			)
		},

		// TODO
		mapMakeIsland (map) {
			const mapCenter = {
				x: config.mapSize / 2 - 0.5,
				y: config.mapSize / 2 - 0.5,
			}
			const maxDistance = this.mapDistance(
				mapCenter, 
				{
					x: config.mapSize / 2, 
					y: config.mapSize / 2
				}
			)

			for (x = 0; x < config.mapSize; x++) {
				for (y = 0; y < config.mapSize; y++) {
					const distance = this.mapDistance(
						mapCenter, 
						{x: x, y: y}
					)

					const ratio = maxDistance / distance
					// console.log(x, y, 'ratio', ratio)
					map[x][y] *= ratio * 12
				}
			}
			return map
		},

		roundMapHeight (map) {
			for (x = 0; x < config.mapSize; x++) {
				for (y = 0; y < config.mapSize; y++) {
					map[x][y] = Math.floor(map[x][y])
				}
			}
		},

		createMap () {
			// Procedural map generation
			this.createMapData('height', config.mapValueRange.height)
			this.createMapData('moisture', config.mapValueRange.moisture)
		},
		
		createMapData (type, range) {
			// Random seed the noise generator
			noise.seed(Math.random())
			
			let dataMap
			if (type === 'height') {
				dataMap = this.heightMap
			} else if (type === 'moisture') {
				dataMap = this.moistureMap
			}
			
			for (x = 0; x < config.mapSize; x++) {
				dataMap[x] = []
				for (y = 0; y < config.mapSize; y++) {

					let value = 0

					// Stupid random value
					if (config.mapNoise[type].stupidRandom) {
						value = Math.random()

					// Noise based value
					} else {
						const nz = [] // noize
						for (h = 0; h < config.mapNoise[type].harmonics.length; h++) {
							nz[h] = map.normalizeNoise(
								noise.simplex2(
									x / (config.mapNoise[type].frequency / Math.pow(2, h)), 
									y / (config.mapNoise[type].frequency / Math.pow(2, h))
								)
							)

							// Force sea
							if (config.mapPostprocess[type].forceSea) {
								nz[h] = Math.pow(nz[h], config.mapPostprocess[type].forceSeaPower)
							}

							// Revert values
							if (config.mapPostprocess[type].revert) {
								nz[h] = 1 - nz[h]
							}

							value += nz[h] * config.mapNoise[type].harmonics[h]
						}
					}

					dataMap[x][y] = value * range
				}
			}
			
			// Normalizing values
			if (config.mapPostprocess[type].normalize) {
				this.normalizeMap(dataMap, config.mapValueRange[type])
			}
			
			// Make map values as integers
			this.roundMapHeight(dataMap)
			
			// console.log('dataMap', type, dataMap)
			this.mapLogRange(dataMap, type)
		}
	}
	return map
}

////////////////////////////////////////////////////////////////////////////////
// CAMERA
const createCamera = (scene) => {
	// Add a camera to the scene and attach it to the canvas
	const camera = new BABYLON.ArcRotateCamera(
		"Camera", 
		Math.PI / 4, 
		Math.PI / 4, 
		60, 
		BABYLON.Vector3.Zero(), 
		scene
	)
	camera.attachControl(canvas, true)
	
	return camera
}

// LIGHTS
const createLights = (scene) => {
	// Add lights to the scene
	const hemiLight = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene)
	// const light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(0, 1, -1), scene)
	// const sunLight = new BABYLON.DirectionalLight("DirectionalLight", new BABYLON.Vector3(0, -1, 1), scene);
	}

// MATERIALS
const createMaterials = (scene, terrain) => {
	// Terrain materials
	for (var [name, value] of Object.entries(terrain)){
		terrain[name].material = new BABYLON.StandardMaterial(name, scene)
		terrain[name].material.diffuseColor = new BABYLON.Color3.FromHexString(value.color)

		// Let sea and ice shine!
		if (
			name !== 'deepsea' &&
			name !== 'sea' &&
			name !== 'shore' &&
			name !== 'ice'
		) {
			terrain[name].material.specularColor = new BABYLON.Color3.Black()
		}
		// terrain[t].material.emissiveColor = new BABYLON.Color3.FromHexString(terrain[t].color)
		// terrain[t].material.ambientColor = new BABYLON.Color3.FromHexString(terrain[t].color)
	}
}

// BIOMES
const getBiome = (height, moisture) => {
	   
	if (height < 1) { return 'deepsea' }
	if (height < 2) { return 'sea' }
	if (height < 3) { return 'shore' }

	if (height < 4) {
		if (moisture < 1) {
			return 'whitebeach'
		}??else if (moisture < 3) {
			return 'beach'
		} else {
			return 'swamp'
		}
	}
	if (height < 5) {
		if (moisture < 1) {
			return 'desert'
		}??else if (moisture < 3) {
			return 'grass'
		} else {
			return 'plain'
		}
	}
	if (height < 6) {
		if (moisture < 1) {
			return 'grass'
		}??else if (moisture < 3) {
			return 'plain'
		} else {
			return 'forest'
		}
	}
	if (height < 7) {
		if (moisture < 1) {
			return 'plain'
		}??else if (moisture < 3) {
			return 'forest'
		} else {
			return 'deepforest'
		}
	}
	if (height < 8) {
		if (moisture < 1) {
			return 'mountain'
		}??else if (moisture < 2) {
			return 'forest'
		}??else if (moisture < 3) {
			return 'deepforest'
		} else {
			return 'pineforest'
		}
	}

	if (height < 9) {
		if (moisture < 1) {
			return 'mountain'
		} else if (moisture < 3) {
			return 'highmountain'
		} else {
			return 'pineforest'
		}
	}
	if (height < 10) {
		if (moisture < 2) {
			return 'scorched'
		} else {
			return 'snow'
		}
	}
	return 'ice'
	
	// From https://www.redblobgames.com/maps/terrain-from-noise/
	//   if (e < 0.1) return OCEAN;
	//   if (e < 0.12) return BEACH;
	//   if (e > 0.8) {
	//     if (m < 0.1) return SCORCHED;
	//     if (m < 0.2) return BARE;
	//     if (m < 0.5) return TUNDRA;
	//     return SNOW;
	//   }
	//   if (e > 0.6) {
	//     if (m < 0.33) return TEMPERATE_DESERT;
	//     if (m < 0.66) return SHRUBLAND;
	//     return TAIGA;
	//   }
	//   if (e > 0.3) {
	//     if (m < 0.16) return TEMPERATE_DESERT;
	//     if (m < 0.50) return GRASSLAND;
	//     if (m < 0.83) return TEMPERATE_DECIDUOUS_FOREST;
	//     return TEMPERATE_RAIN_FOREST;
	//   }
	//   if (m < 0.16) return SUBTROPICAL_DESERT;
	//   if (m < 0.33) return GRASSLAND;
	//   if (m < 0.66) return TROPICAL_SEASONAL_FOREST;
	//   return TROPICAL_RAIN_FOREST;
}

// TERRAIN
// TODO: move this into map generation!
const checkTileValue = (value, type) => {
	const max = mapConfig.mapValueRange[type] - 1
	if (value < 0) {
		console.warn(`Tile ${type} below zero!`, value)
		return 0

	} else if (value > max) {
		console.warn(
			`Tile ${type} above max terrain ${type} (${max})!`, 
			value
		)
		return max
	}
	return value
}

const createTerrain = (scene, terrain, heightMap, moistureMap) => {
	// Terrain tiles
	for (x = 0; x < heightMap[0].length; x++) {
		for (y = 0; y < heightMap.length; y++) {
			
			let height = heightMap[x][y]
			let moisture = moistureMap[x][y]

			// Check if height and moisture are valid (in the range)
			height = checkTileValue(height, 'height')
			moisture = checkTileValue(moisture, 'moisture')

			// Compute tile height
			let baseHeight = height
			// Flatten sea
			if (baseHeight < mapConfig.mapSeaMinLevel) {
				baseHeight = mapConfig.mapSeaMinLevel
			}
			const renderHeight = baseHeight * mapConfig.mapHeight

			// Create tile mesh
			const tile = BABYLON.MeshBuilder.CreateBox(
				"box", 
				{
					height: renderHeight, 
					width: 1, 
					depth: 1
				}, 
				scene
			)

			// Position tile mesh
			tile.position = new BABYLON.Vector3(
				-mapConfig.mapSize / 2 + x, 
				renderHeight / 2, 
				-mapConfig.mapSize / 2 + y
			)
			// Give the tile mesh a material
			const biome = getBiome(height, moisture)
			tile.material = terrain[biome].material
		}
	}
}

////////////////////////////////////////////////////////////////////////////////
// SCENE
const createScene = (map, terrain) => {

	const scene = new BABYLON.Scene(engine)
	const camera = createCamera(scene)

	createLights(scene)
	createMaterials(scene, terrain)
	createTerrain(scene, terrain, map.heightMap, map.moistureMap)

	// SSAO (ambiant occlusion)
	if (renderConfig.useSSAO) {
		// Create SSAO and configure all properties (for the example)
		var ssaoRatio = {
			ssaoRatio: 0.5, // Ratio of the SSAO post-process, in a lower resolution
			combineRatio: 1.0 // Ratio of the combine post-process (combines the SSAO and the scene)
		}

		var ssao = new BABYLON.SSAORenderingPipeline("ssao", scene, ssaoRatio)
		ssao.fallOff = 0.000001
		ssao.area = 1
		ssao.radius = 0.0001
		ssao.totalStrength = 1.0
		ssao.base = 0.25

		// Attach camera to the SSAO render pipeline
		scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera)
	}

	return scene
}

///////////////////////////////////////////////////////////////////////////
// INIT

const map = Map(mapConfig)
map.createMap()

const scene = createScene(map, terrain) // Call the createScene function

// Register a render loop to repeatedly render the scene
engine.runRenderLoop(() => {
	scene.render()
})

// Watch for browser/canvas resize events
window.addEventListener("resize", () => {
	engine.resize()
})
    return(
    <>
<canvas id="renderCanvas" touch-action="none"></canvas>
    </>
    )
} 