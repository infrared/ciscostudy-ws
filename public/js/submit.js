

$('#form-ios').submit(function(e){
    
    e.preventDefault();    
    var self = $(this);
    var data = self.serialize();
    console.log(data);

    
    $.ajax({
        url: '/submit',
        method: 'POST',
        data: data,
        dataType: 'JSON',
        success: function(data) {
            console.log(data);
            $(self).get(0).reset();
        }
    });
});

$('#form-definition').submit(function(e) {
    e.preventDefault();
    var self = $(this);
    var data = self.serialize();
    console.log(data);
    
    $.ajax({
        url: '/submit',
        method: 'POST',
        data: data,
        dataType: 'JSON',
        success: function(data) {
            console.log(data);
            $(self).get(0).reset();
        }
    });
 
});