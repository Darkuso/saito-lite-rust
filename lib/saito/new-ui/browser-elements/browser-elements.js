
if (typeof window !== "undefined") {

var mutationObserver = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
    if (mutation.addedNodes.length > 0) {
      treatElements(mutation.addedNodes);
    }
  });
});

mutationObserver.observe(document.documentElement, {
  attributes: true,
  characterData: true,
  childList: true,
  subtree: true,
  attributeOldValue: true,
});

window.sanitize = function (msg) {
  let result = dompurify.sanitize(msg);
  return result;
};


window.salert = function (message) {
  if (document.getElementById("alert-wrapper")) {
    return;
  }
  var wrapper = document.createElement("div");
  wrapper.id = "alert-wrapper";
  var html = '<div id="alert-shim">';
  html += '<div id="alert-box">';
  html += '<p class="alert-message">' + message + "</p>";
  html += '<div id="alert-buttons"><button id="alert-ok">OK</button>';
  html += "</div></div></div>";
  wrapper.innerHTML = sanitize(html);
  document.body.appendChild(wrapper);
  setTimeout(() => {
    document.querySelector("#alert-box").style.top = "0";
  }, 100);
  document.querySelector("#alert-ok").focus();
  //document.querySelector('#alert-ok').select();
  document.querySelector("#alert-shim").addEventListener("keyup", function (event) {
    if (event.keyCode === 13) {
      event.preventDefault();
      document.querySelector("#alert-ok").click();
    }
  });
  document.querySelector("#alert-ok").addEventListener(
    "click",
    function () {
      wrapper.remove();
    },
    false
  );
};

window.sconfirm = function (message) {
  if (document.getElementById("alert-wrapper")) {
    return;
  }
  return new Promise((resolve, reject) => {
    var wrapper = document.createElement("div");
    wrapper.id = "alert-wrapper";
    var html = '<div id="alert-shim">';
    html += '<div id="alert-box">';
    html += '<p class="alert-message">' + message + "</p>";
    html +=
      '<div id="alert-buttons"><button id="alert-cancel">Cancel</button><button id="alert-ok">OK</button>';
    html += "</div></div></div>";
    wrapper.innerHTML = sanitize(html);
    document.body.appendChild(wrapper);
    setTimeout(() => {
      document.getElementById("alert-box").style.top = "0";
    }, 100);
    document.getElementById("alert-ok").focus();
    //document.getElementById('alert-ok').select();
    document.getElementById("alert-shim").onclick = (event) => {
      if (event.keyCode === 13) {
        event.preventDefault();
        document.getElementById("alert-ok").click();
      }
    };
    document.getElementById("alert-ok").onclick = () => {
      wrapper.remove();
      resolve(true);
      // }, false;
    };
    document.getElementById("alert-cancel").onclick = () => {
      wrapper.remove();
      resolve(false);
      // }, false);
    };
  });
};

window.sprompt = function (message) {
  if (document.getElementById("alert-wrapper")) {
    return;
  }
  return new Promise((resolve, reject) => {
    var wrapper = document.createElement("div");
    wrapper.id = "alert-wrapper";
    var html = '<div id="alert-shim">';
    html += '<div id="alert-box">';
    html += '<p class="alert-message">' + message + "</p>";
    html +=
      '<div class="alert-prompt"><input type="text" id="promptval" class="promptval" /></div>';
    html +=
      '<div id="alert-buttons"><button id="alert-cancel">Cancel</button><button id="alert-ok">OK</button>';
    html += "</div></div></div>";
    wrapper.innerHTML = sanitize(html);
    document.body.appendChild(wrapper);
    document.querySelector("#promptval").focus();
    document.querySelector("#promptval").select();
    setTimeout(() => {
      document.querySelector("#alert-box").style.top = "0";
    }, 100);
    document.querySelector("#alert-shim").addEventListener("keyup", function (event) {
      if (event.keyCode === 13) {
        event.preventDefault();
        document.querySelector("#alert-ok").click();
      }
    });
    document.querySelector("#alert-ok").addEventListener(
      "click",
      function () {
        var val = document.querySelector("#promptval").value;
        wrapper.remove();
        resolve(val);
      },
      false
    );
    document.querySelector("#alert-cancel").addEventListener(
      "click",
      function () {
        wrapper.remove();
        resolve(false);
      },
      false
    );
  });
};

window.siteMessage = function (message, killtime = 9999999) {
  if (document.getElementById("message-wrapper")) {
    document.getElementById("message-wrapper").remove();
  }
  var wrapper = document.createElement("div");
  wrapper.id = "message-wrapper";
  var html = '<div id="message-box">';
  html += '<p class="message-message">' + message + "</p>";
  html += "</div>";
  wrapper.innerHTML = sanitize(html);
  document.body.appendChild(wrapper);
  setTimeout(() => {
    wrapper.remove();
  }, killtime);
  document.querySelector("#message-wrapper").addEventListener(
    "click",
    function () {
      wrapper.remove();
    },
    false
  );
};


function treatElements(nodeList) {
  for (var i = 0; i < nodeList.length; i++) {
    if (nodeList[i].files) {
      treatFiles(nodeList[i]);
    }
    if (nodeList[i].childNodes.length >= 1) {
      treatElements(nodeList[i].childNodes);
    }
  }
}

function treatFiles(input) {
  if (input.classList.contains("treated")) {
    return;
  } else {
    input.addEventListener("change", function (e) {
      var fileName = "";
      if (this.files && this.files.length > 1) {
        fileName = this.files.length + " files selected.";
      } else {
        fileName = e.target.value.split("\\").pop();
      }
      if (fileName) {
        filelabel.style.border = "none";
        filelabel.innerHTML = sanitize(fileName);
      } else {
        filelabel.innerHTML = sanitize(labelVal);
      }
    });
    input.classList.add("treated");
    var filelabel = document.createElement("label");
    filelabel.classList.add("treated");
    filelabel.innerHTML = "Choose File";
    filelabel.htmlFor = input.id;
    filelabel.id = input.id + "-label";
    var parent = input.parentNode;
    parent.appendChild(filelabel);
  }
}


HTMLElement.prototype.destroy = function destroy() {
  try {
    this.parentNode.removeChild(this);
  } catch (err) {
    console.err(err);
  }
};

}


