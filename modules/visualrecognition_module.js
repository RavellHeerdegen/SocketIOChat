var VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3');
const fs = require("fs");

var visualRecognition = new VisualRecognitionV3({
    version: '2018-03-19',
    iam_apikey: 'zbNcTeWowygqtJ_FBgSQB8AloInXCuOMoYrdLfIxEly4',
    headers: {
        'X-Watson-Learning-Opt-Out': 'true'
    }
});

function detectFace(socket, path) {
    let stream = fs.createReadStream(path);

    var params = {
        images_file: stream
    };
    return new Promise((resolve, reject) => {
        visualRecognition.detectFaces(params, (err, response) => {
            if (err) {
                console.log(err);
                socket.emit("face_recog_failed", { text: "Face detection failed. Please try again", result: false });
            } else {
                let result = JSON.stringify(response, null, 2).toString();
                result = JSON.parse(result);

                if (result.images[0]["faces"].length > 0) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            }
            
        });
    });
}

module.exports = {detectFace};