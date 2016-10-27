import * as THREE from 'three';
import FBO from './class/FBO';
const glslify = require( 'glslify' );
const OrbitControls = require( 'three-orbit-controls' )( THREE );
const OBJLoader = require( './class/OBJLoader' )( THREE );

export default class Webgl {
  constructor( width, height ) {
    this.params = {};

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera( 50, width / height, 1, 10000 );
    this.camera.position.z = 100;

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize( width, height );
    this.renderer.setClearColor( 0x262626 );

    this.controls = new OrbitControls( this.camera );

    this.composer = null;

    this.fbo = false;

    this.type = 'obj'

    // this.provideData( 'random' );
    this.provideData( this.type );
    // this.provideData( 'obj' );
  }

  provideData( type ) {
    const width = 256;
    const height = 256;

    let data = {};

    if ( type === 'image' ) {
      const img = new Image();

      img.onload = () => {
        data = this.getImage( img, img.width, img.height, 100 );
        this.createFBO( data, width, height );
      };

      img.src = 'img/test.jpg';
    } else if ( type === 'random' ) {
      data = this.getRandomData( width, height, 256 );
      this.createFBO( data, width, height );
    } else if ( type === 'obj' ) {
      const loader = new THREE.OBJLoader();

      loader.load(
          'obj/test.obj',
          ( obj ) => {
            data = this.parseMesh( obj );
            this.createFBO( data, width, height );
          }
      );
    }
  }

  createFBO( data, width, height ) {
    const positions = new THREE.DataTexture( data, width, height, THREE.RGBFormat, THREE.FloatType );
    positions.needsUpdate = true;

    // simulation shader used to update the particles' positions
    const simulationShader = new THREE.ShaderMaterial({
      uniforms: {
        positions: { type: 't', value: positions },
      },
      vertexShader: glslify( './shaders/simulation_vs.glsl' ),
      fragmentShader: glslify( './shaders/simulation_fs.glsl' ),
    });

    // render shader to display the particles on screen
    // the 'positions' uniform will be set after the FBO.update() call
    const renderShader = new THREE.ShaderMaterial({
      uniforms: {
        positions: { type: 't', value: null },
        pointSize: { type: 'f', value: 2 },
      },
      transparent: true,
      vertexShader: glslify( './shaders/render_vs' ),
      fragmentShader: glslify( './shaders/render_fs' ),
    });

    // init the FBO
    this.fbo = new FBO( width, height, this.renderer, simulationShader, renderShader );
    this.scene.add( this.fbo.particles );

    if (this.type = 'obj') this.fbo.particles.position.z += 30;
  }

  getRandomData( width, height, size ) {
    let len = width * height * 3;
    const data = new Float32Array( len );

    while ( len-- )data[len] = ( Math.random() * 2 - 1 ) * size;

    return data;
  }

  getImage( img, width, height, elevation ) {

    const canvas = document.createElement( 'canvas' );
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext( '2d' );
    ctx.drawImage( img, 0, 0 );

    const imgData = ctx.getImageData( 0, 0, width, height );
    const iData = imgData.data;

    const l = ( width * height );
    const data = new Float32Array( l * 3 );
    for ( let i = 0; i < l; i++ ) {
      const i3 = i * 3;
      const i4 = i * 4;
      data[i3] = ( ( i % width ) / width - 0.5 ) * width;
      data[i3 + 1] = ( iData[i4] / 0xFF * 0.299 + iData[i4 + 1] / 0xFF * 0.587 + iData[i4 + 2] / 0xFF * 0.114 ) * elevation;
      data[i3 + 2] = ( ( i / width ) / height - 0.5 ) * height;
    }

    return data;
  }

  parseMesh( obj ) {

    const vertices = [];

    obj.traverse( ( child ) => {

      if ( child instanceof THREE.Mesh ) {
        const meshVertices = child.geometry.attributes.position.array;

        for ( let i = 0; i < meshVertices.length; i++ ) {
          vertices.push( meshVertices[i]);
        }
      } else {
        child.traverse( ( nextChild ) => {
          if ( child instanceof THREE.Mesh ) {
            const meshVertices = nextChild.geometry.attributes.position.array;

            for ( let i = 0; i < meshVertices.length; i++ ) {
              vertices.push( meshVertices[i]);
            }
          } else {
            nextChild.traverse( ( newChild ) => {
              if ( newChild instanceof THREE.Mesh ) {
                const meshVertices = newChild.geometry.attributes.position.array;

                for ( let i = 0; i < meshVertices.length; i++ ) {
                  vertices.push( meshVertices[i]);
                }
              } else {
                newChild.traverse( ( lastChild ) => {
                  if ( lastChild instanceof THREE.Mesh ) {
                    const meshVertices = lastChild.geometry.attributes.position.array;

                    for ( let i = 0; i < meshVertices.length; i++ ) {
                      vertices.push( meshVertices[i]);
                    }
                  }
                });
              }
            });
          }
        });
      }
    });

    const total = vertices.length;
    const size = parseInt( Math.sqrt( total * 3 ), 10 );
    const data = new Float32Array( size * size * 3 );

    for ( let i = 0; i < total; i += 3 ) {
      data[i] = vertices[i];
      data[i + 1] = vertices[i + 1];
      data[i + 2] = vertices[i + 2];

    //   if (vertices[i] === 0) console.log(0);
    //   if (vertices[i+1] === 0) console.log(1);
    //   if (vertices[i+2] === 0) console.log(2);
    }

    // console.log(data);

    return data;
  }

  resize( width, height ) {
    if ( this.composer ) {
      this.composer.setSize( width, height );
    }

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize( width, height );
  }

  render() {
    if ( this.fbo ) {
      this.fbo.update();
      this.renderer.render( this.scene, this.camera );
    }
  }
}
