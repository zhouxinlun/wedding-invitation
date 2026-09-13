/* A standard MP4 carries colour on the left and a person matte on the right.
   The transparent canvas lets the people cross the existing floral frame. */
(() => {
  window.createWeddingPopout = (video, canvas) => {
    const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false});
    if(!gl)return null;
    const shaders=[];let program,buffer,texture;
    function dispose(){
      if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);
      if(program)gl.deleteProgram(program);shaders.forEach(shader=>gl.deleteShader(shader));
    }
    try{
      const shader=(type,source)=>{
        const item=gl.createShader(type);shaders.push(item);gl.shaderSource(item,source);gl.compileShader(item);
        if(!gl.getShaderParameter(item,gl.COMPILE_STATUS))throw Error('Portrait shader unavailable');
        return item;
      };
      program=gl.createProgram();
      gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 position; varying vec2 uv; void main(){gl_Position=vec4(position,0.,1.);uv=vec2((position.x+1.)*.5,(1.-position.y)*.5);}'));
      gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float; uniform sampler2D frame; uniform float pixel; varying vec2 uv; void main(){vec3 colour=texture2D(frame,vec2(clamp(uv.x*.5,pixel,.5-pixel),uv.y)).rgb; float alpha=texture2D(frame,vec2(clamp(.5+uv.x*.5,.5+pixel,1.-pixel),uv.y)).r; alpha=smoothstep(.06,.98,alpha); gl_FragColor=vec4(colour*alpha,alpha);}'));
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Portrait compositor unavailable');
      gl.useProgram(program);
      buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
      texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program,'frame'),0);
      const pixel=gl.getUniformLocation(program,'pixel');
      return {
        draw(){
          if(video.readyState<2)return false;
          if(gl.isContextLost())throw Error('Portrait compositor lost');
          if(canvas.width!==video.videoWidth/2||canvas.height!==video.videoHeight){
            canvas.width=video.videoWidth/2;canvas.height=video.videoHeight;gl.viewport(0,0,canvas.width,canvas.height);
          }
          gl.uniform1f(pixel,.5/video.videoWidth);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);
          gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
          return true;
        },dispose
      };
    }catch(_){dispose();return null;}
  };
})();
